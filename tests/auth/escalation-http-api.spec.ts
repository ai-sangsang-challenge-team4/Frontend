import { expect, test } from '@playwright/test';
import { configureApiClient } from '../../src/shared/api/apiClient';
import { getApiErrorMessage } from '../../src/shared/api/apiError';
import { httpEscalationApi } from '../../src/features/escalation/api/httpEscalationApi';

// Checks request paths and bodies against the backend OpenAPI spec with a stubbed fetch.
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
  escalationId: 3,
  escalationStatus: 'UNDER_REVIEW',
  riskReviewStatus: null,
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
  mockFetch(() => json(201, { riskLevel: 'HIGH', status: 'PENDING_ADMIN_APPROVAL' }));

  await expect(httpEscalationApi.submitRiskReview('12', { reason: '오탐', riskScore: 5 }))
    .resolves.toMatchObject({ riskLevel: 'HIGH', status: 'PENDING_ADMIN_APPROVAL' });
  expect(calls[0].url).toBe('https://api.test/teacher/complaints/12/risk-reviews');
  expect(JSON.parse(String(calls[0].init.body))).toEqual({ reason: '오탐', riskScore: 5 });
});

test('관리자 목록·상세·검토·완료·위험도 결정은 escalationId 기준 경로를 쓴다', async () => {
  mockFetch((call) => call.url.endsWith('/admin/escalations?status=SHARED&riskLevel=EMERGENCY') ? json(200, []) : json(200, state));

  await httpEscalationApi.listAdminEscalations({ status: 'SHARED', riskLevel: 'EMERGENCY' });
  await httpEscalationApi.getAdminEscalation(3);
  await httpEscalationApi.getAdminEscalationMessages(3);
  await httpEscalationApi.getAdminEscalationRisk(3);
  await httpEscalationApi.getAdminEscalationHistory(3);
  await httpEscalationApi.startEscalationReview(3, { message: '검토 시작' });
  await httpEscalationApi.completeEscalation(3, { message: '완료' });
  await expect(httpEscalationApi.decideRiskChange(3, { message: '승인', status: 'APPLIED' })).resolves.toEqual(state);

  expect(calls.map((call) => `${call.init.method} ${call.url.replace('https://api.test', '')}`)).toEqual([
    'GET /admin/escalations?status=SHARED&riskLevel=EMERGENCY',
    'GET /admin/escalations/3',
    'GET /admin/escalations/3/messages',
    'GET /admin/escalations/3/risk',
    'GET /admin/escalations/3/history',
    'POST /admin/escalations/3/review',
    'POST /admin/escalations/3/complete',
    'POST /admin/escalations/3/risk-change-decision',
  ]);
  expect(JSON.parse(String(calls[7].init.body))).toEqual({ message: '승인', status: 'APPLIED' });
});

test('409 ErrorResponse의 message를 그대로 노출한다', async () => {
  mockFetch(() => json(409, { code: 'ESCALATION_CONFLICT', message: '승인 대기 중에는 완료할 수 없습니다.', path: '/admin/escalations/3/complete' }));

  const error = await httpEscalationApi.completeEscalation(3, { message: '완료' }).catch((caught: unknown) => caught);
  expect(error).toMatchObject({ kind: 'CONFLICT', status: 409 });
  expect(getApiErrorMessage(error)).toBe('승인 대기 중에는 완료할 수 없습니다.');
});
