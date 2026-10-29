import { expect, test } from '@playwright/test';
import { configureApiClient } from '../../src/shared/api/apiClient';
import { getApiErrorMessage } from '../../src/shared/api/apiError';
import { httpEscalationApi } from '../../src/features/escalation/api/httpEscalationApi';

// Checks request paths and bodies against the backend controllers with a stubbed fetch.
// This does not prove the real server accepts them.

type FetchCall = { url: string; init: RequestInit };

const originalFetch = globalThis.fetch;
let calls: FetchCall[] = [];

function mockFetch(handler: (call: FetchCall) => Response) {
  globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const call = { url: String(input), init };
    calls.push(call);
    return handler(call);
  }) as typeof fetch;
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const state = {
  currentRiskLevel: 'EMERGENCY',
  currentRiskScore: 7,
  emergencyReviewRequestId: null,
  escalationId: 3,
  escalationStatus: 'UNDER_REVIEW',
  riskReviewStatus: null,
  safetyLock: false,
};

const emergencyReview = {
  requestId: 9,
  complaintId: 12,
  riskAnalysisId: 4,
  previousRiskScore: 7,
  previousRiskLevel: 'EMERGENCY',
  requestedRiskScore: 5,
  requestedRiskLevel: 'HIGH',
  reason: '오탐',
  status: 'PENDING_ADMIN_APPROVAL',
  safetyLock: true,
  reviewerId: 3,
  reviewerName: 'Demo Admin',
  requestedAt: '2026-10-28T12:18:23.227',
  decidedAt: null,
  safetyLockUpdatedAt: '2026-10-28T12:18:23.227',
};

test.beforeEach(() => {
  calls = [];
  configureApiClient({ baseUrl: 'https://api.test', timeoutMs: 1_000, getAccessToken: () => 'jwt', onUnauthorized: () => undefined });
});

test.afterAll(() => {
  globalThis.fetch = originalFetch;
});

test('교사 공유 상태 조회와 공유 요청은 스펙 경로·본문으로 보낸다', async () => {
  mockFetch((call) => call.init.method === 'POST' ? new Response('"shared"', { status: 201 }) : json(200, state));

  await expect(httpEscalationApi.getEscalationState(12)).resolves.toEqual(state);
  await httpEscalationApi.shareEscalation(12, { adminId: null, reason: '공동 검토 필요', scopes: ['MASKING_MESSAGES'] });

  expect(calls.map((call) => `${call.init.method} ${call.url}`)).toEqual([
    'GET https://api.test/teacher/complaints/12/escalation',
    'POST https://api.test/teacher/complaints/12/escalation',
  ]);
  expect(new Headers(calls[0].init.headers).get('Authorization')).toBe('Bearer jwt');
  expect(JSON.parse(String(calls[1].init.body))).toEqual({ adminId: null, reason: '공동 검토 필요', scopes: ['MASKING_MESSAGES'] });
});

test('숫자 complaintId가 아니면 서버로 요청을 보내지 않는다', async () => {
  mockFetch(() => json(200, state));

  await expect(httpEscalationApi.getEscalationState('thread-001')).rejects.toMatchObject({ kind: 'BAD_REQUEST', status: 0 });
  await expect(httpEscalationApi.submitRiskReview('thread-001', { reason: null, riskScore: 7 })).rejects.toBeTruthy();
  expect(calls).toHaveLength(0);
});

test('교사 위험도 검토는 risk-reviews로 점수와 사유를 보낸다', async () => {
  // Lowering EMERGENCY: NON_NULL omits riskReviewId and returns the emergency review ID instead.
  mockFetch(() => json(201, {
    emergencyReviewRequestId: 9, riskLevel: 'HIGH', safetyLock: true, status: 'PENDING_ADMIN_APPROVAL',
  }));

  const result = await httpEscalationApi.submitRiskReview('12', { reason: '오탐', riskScore: 5 });
  expect(result).toMatchObject({ emergencyReviewRequestId: 9, riskLevel: 'HIGH', safetyLock: true, status: 'PENDING_ADMIN_APPROVAL' });
  expect(result).not.toHaveProperty('riskReviewId');
  expect(calls[0].url).toBe('https://api.test/teacher/complaints/12/risk-reviews');
  expect(JSON.parse(String(calls[0].init.body))).toEqual({ reason: '오탐', riskScore: 5 });
});

test('교사 Emergency 재검토 요청·현재 요청 조회는 complaintId 기준 경로를 쓴다', async () => {
  // POST answers 201 (Swagger says 200); only 2xx matters.
  mockFetch((call) => call.init.method === 'POST' ? json(201, emergencyReview) : json(200, emergencyReview));

  await expect(httpEscalationApi.requestEmergencyReview(12, { reason: '오탐', riskScore: 5 })).resolves.toEqual(emergencyReview);
  await expect(httpEscalationApi.getCurrentEmergencyReview(12)).resolves.toEqual(emergencyReview);

  expect(calls.map((call) => `${call.init.method} ${call.url.replace('https://api.test', '')}`)).toEqual([
    'POST /teacher/complaints/12/emergency-review',
    'GET /teacher/complaints/12/emergency-review/current',
  ]);
  expect(JSON.parse(String(calls[0].init.body))).toEqual({ reason: '오탐', riskScore: 5 });
});

test('현재 Emergency 재검토 요청이 없으면(404 EMERGENCY_REVIEW_NOT_FOUND) null을 돌려준다', async () => {
  mockFetch((call) => call.url.includes('/12/')
    ? json(404, { code: 'EMERGENCY_REVIEW_NOT_FOUND', message: 'Emergency 재검토 요청을 찾을 수 없습니다.' })
    : json(404, { code: 'COMPLAINT_NOT_FOUND', message: '민원을 찾을 수 없습니다.' }));

  await expect(httpEscalationApi.getCurrentEmergencyReview(12)).resolves.toBeNull();
  // A missing complaint is still an error.
  await expect(httpEscalationApi.getCurrentEmergencyReview(13)).rejects.toMatchObject({ code: 'COMPLAINT_NOT_FOUND', status: 404 });
});

test('관리자 Emergency 재검토 목록·상세·결정·잠금 해제는 requestId 기준 경로를 쓴다', async () => {
  mockFetch((call) => call.url.endsWith('/admin/emergency-review') ? json(200, [emergencyReview]) : json(200, emergencyReview));

  await expect(httpEscalationApi.listAdminEmergencyReviews()).resolves.toEqual([emergencyReview]);
  await httpEscalationApi.getAdminEmergencyReview(9);
  await httpEscalationApi.updateEmergencyReview(9, { message: '승인', status: 'APPLIED' });
  await httpEscalationApi.updateEmergencyReview(9, { safetyLock: false });

  expect(calls.map((call) => `${call.init.method} ${call.url.replace('https://api.test', '')}`)).toEqual([
    'GET /admin/emergency-review',
    'GET /admin/emergency-review/9',
    'PATCH /admin/emergency-review/9',
    'PATCH /admin/emergency-review/9',
  ]);
  expect(JSON.parse(String(calls[2].init.body))).toEqual({ message: '승인', status: 'APPLIED' });
  expect(JSON.parse(String(calls[3].init.body))).toEqual({ safetyLock: false });
});

test('관리자 목록·상세·검토·완료는 escalationId 기준 경로를 쓰고 삭제된 위험도 결정 API는 부르지 않는다', async () => {
  mockFetch((call) => call.url.endsWith('/admin/escalations?status=SHARED&riskLevel=EMERGENCY') ? json(200, []) : json(200, state));

  await httpEscalationApi.listAdminEscalations({ status: 'SHARED', riskLevel: 'EMERGENCY' });
  await httpEscalationApi.getAdminEscalation(3);
  await httpEscalationApi.getAdminEscalationMessages(3);
  await httpEscalationApi.getAdminEscalationRisk(3);
  await httpEscalationApi.getAdminEscalationHistory(3);
  await httpEscalationApi.startEscalationReview(3, { message: '검토 시작' });
  await expect(httpEscalationApi.completeEscalation(3, { message: '완료' })).resolves.toEqual(state);
  expect(httpEscalationApi).not.toHaveProperty('decideRiskChange');

  expect(calls.map((call) => `${call.init.method} ${call.url.replace('https://api.test', '')}`)).toEqual([
    'GET /admin/escalations?status=SHARED&riskLevel=EMERGENCY',
    'GET /admin/escalations/3',
    'GET /admin/escalations/3/messages',
    'GET /admin/escalations/3/risk',
    'GET /admin/escalations/3/history',
    'POST /admin/escalations/3/review',
    'POST /admin/escalations/3/complete',
  ]);
});

test('409 ErrorResponse의 message를 그대로 노출한다', async () => {
  mockFetch(() => json(409, { code: 'ESCALATION_CONFLICT', message: '승인 대기 중에는 완료할 수 없습니다.', path: '/admin/escalations/3/complete' }));

  const error = await httpEscalationApi.completeEscalation(3, { message: '완료' }).catch((caught: unknown) => caught);
  expect(error).toMatchObject({ kind: 'CONFLICT', status: 409 });
  expect(getApiErrorMessage(error)).toBe('승인 대기 중에는 완료할 수 없습니다.');
});

test('재검토가 승인 대기면 완료 409 ESCALATION_STATE_INVALID의 서버 사유를 고정 문구로 덮지 않는다', async () => {
  const message = 'Emergency 재검토 요청을 승인하거나 거부한 뒤 처리 완료할 수 있습니다.';
  mockFetch(() => json(409, { code: 'ESCALATION_STATE_INVALID', message, path: '/admin/escalations/3/complete' }));

  const error = await httpEscalationApi.completeEscalation(3, { message: '완료' }).catch((caught: unknown) => caught);
  expect(getApiErrorMessage(error)).toBe(message);
});
