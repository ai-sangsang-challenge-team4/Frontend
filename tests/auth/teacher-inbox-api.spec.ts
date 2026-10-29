import { expect, test } from '@playwright/test';
import { configureApiClient } from '../../src/shared/api/apiClient';
import { toServerInstant } from '../../src/shared/api/serverDateTime';
import { httpTeacherInboxApi } from '../../src/features/message/api/httpTeacherInboxApi';
import type { ComplaintListItem, TeacherConversationResponse } from '../../src/features/message/api/teacherInboxTypes';
import type { HistoryEvent, TeacherRiskResponse } from '../../src/features/escalation/escalationTypes';
import {
  markServerDetailFailed,
  markServerDetailLoading,
  mergeListFields,
  mergeServerDetail,
  toActivityLogs,
  toComplaintListQuery,
  toListThread,
  type ServerThreadDetail,
} from '../../src/features/message/serverThreads';

// Request paths against the backend TeacherComplaintController (stubbed fetch, not the real server)
// and the conversion from its responses into the inbox model.

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

const listItem: ComplaintListItem = {
  complaintId: 1,
  title: '긴급 민원 테스트',
  studentId: 1,
  studentName: 'Demo Student',
  counterpartName: 'Demo Parent',
  counterpartRole: 'PARENT',
  academicYear: 2026,
  grade: 3,
  classNo: 2,
  status: 'OPEN',
  waitingFor: 'TEACHER',
  riskAnalysisId: 1,
  riskLevel: 'EMERGENCY',
  aiSummary: '[MOCK] 학부모 민원의 핵심 내용과 요청 사항을 요약한 내용입니다.',
  latestReceivedAt: '2026-10-29T10:42:17.437239',
};

const conversation: TeacherConversationResponse = {
  complaintId: 1,
  allowedActions: ['CREATE_EVIDENCE_PACKAGE', 'REQUEST_ADMIN_REVIEW', 'VIEW_OFFICIAL_PROCEDURE'],
  messages: [
    { messageId: 'message:1', senderRole: 'PARENT', senderName: 'Demo Parent', content: '완충 요약 문장', sentAt: '2026-10-29T10:42:17', summarized: true },
  ],
};

const risk: TeacherRiskResponse = {
  complaintId: 1,
  riskAnalysisId: 1,
  riskScore: 30,
  riskLevel: 'EMERGENCY',
  reviewScore: 7,
  reviewLevel: 'EMERGENCY',
  safetyLock: false,
  analyzedAt: '2026-10-29T10:42:17',
  latestReview: null,
  detectedFactors: [{ code: 'THREAT', name: '위협', evidence: '직접 다치게 하겠습니다', reason: '신체 위해 표현' }],
};

// The backend omits empty history fields (@JsonInclude(NON_NULL)).
const history = [
  { eventId: 'complaint-event:3', type: 'RISK_ANALYZED', occurredAt: '2026-10-29T10:42:17', actorName: 'SYSTEM', riskScore: 30, riskLevel: 'EMERGENCY' },
  { eventId: 'complaint-event:2', type: 'STATUS_CHANGED', occurredAt: '2026-10-29T10:42:16', actorName: 'Demo Parent', newStatus: 'DRAFT' },
] as HistoryEvent[];

function bundle(overrides: Partial<ServerThreadDetail> = {}): ServerThreadDetail {
  return {
    detail: {
      complaintId: 1, title: '긴급 민원 테스트', studentName: 'Demo Student', parentName: 'Demo Parent',
      academicYear: 2026, grade: 3, classNo: 2, status: 'OPEN', waitingFor: 'TEACHER',
      submittedAt: '2026-10-29T10:42:17', riskLevel: 'EMERGENCY',
    },
    conversation,
    risk,
    history,
    ...overrides,
  };
}

test.beforeEach(() => {
  calls = [];
  configureApiClient({ baseUrl: 'https://api.test', timeoutMs: 1_000, getAccessToken: () => 'jwt', onUnauthorized: () => undefined });
});

test.afterAll(() => {
  globalThis.fetch = originalFetch;
});

test('교사 메시지함 조회 API는 백엔드 경로와 목록 쿼리를 사용한다', async () => {
  mockFetch((call) => call.url.includes('?') || call.url.endsWith('/teacher/complaints')
    ? json(200, { content: [], page: 0, size: 10, totalElements: 0, totalPages: 0, first: true, last: true, hasNext: false, hasPrevious: false })
    : json(200, {}));

  await httpTeacherInboxApi.listComplaints({ page: 2, keyword: ' 상담 ', status: 'OPEN', riskLevel: 'HIGH', sort: 'OLDEST' });
  await httpTeacherInboxApi.listComplaints({ keyword: '   ' });
  await httpTeacherInboxApi.getComplaint(1);
  await httpTeacherInboxApi.getConversation(1);
  await httpTeacherInboxApi.getRisk(1);
  await httpTeacherInboxApi.getHistory(1);
  await httpTeacherInboxApi.viewOriginal(1);

  expect(calls.map((call) => `${call.init.method} ${decodeURIComponent(call.url.replace('https://api.test', ''))}`)).toEqual([
    'GET /teacher/complaints?page=2&keyword=상담&status=OPEN&riskLevel=HIGH&sort=OLDEST',
    'GET /teacher/complaints',
    'GET /teacher/complaints/1',
    'GET /teacher/complaints/1/messages',
    'GET /teacher/complaints/1/risk',
    'GET /teacher/complaints/1/history',
    'POST /teacher/complaints/1/original-views',
  ]);
  expect(calls.every((call) => new Headers(call.init.headers).get('Authorization') === 'Bearer jwt')).toBe(true);
});

test('메시지함 필터를 서버 목록 쿼리로 바꾼다', () => {
  expect(toComplaintListQuery({ query: ' 홍길동 ', risk: 'emergency', sort: 'latest', status: 'active' }, 0))
    .toEqual({ page: 0, keyword: '홍길동', status: 'OPEN', riskLevel: 'EMERGENCY', sort: 'LATEST' });
  expect(toComplaintListQuery({ query: '', risk: 'all', sort: 'oldest', status: 'all' }, 3))
    .toEqual({ page: 3, keyword: undefined, status: undefined, riskLevel: undefined, sort: 'OLDEST' });
  expect(toComplaintListQuery({ query: '', risk: 'all', sort: 'latest', status: 'complete' }, 0).status).toBe('CLOSED');
});

test('타임존 없는 서버 시각은 KST로 해석한다', () => {
  expect(toServerInstant('2026-10-28T12:18:23.227')).toBe('2026-10-28T12:18:23.227+09:00');
  expect(new Date(toServerInstant('2026-10-28T12:18:23.227')).toISOString()).toBe('2026-10-28T03:18:23.227Z');
  expect(toServerInstant('2026-10-28T03:18:23Z')).toBe('2026-10-28T03:18:23Z');
  expect(toServerInstant(null)).toBeUndefined();
});

test('목록 행을 BoardThread로 바꾸고 답변 차례로 상담 상태를 정한다', () => {
  const thread = toListThread(listItem);
  expect(thread).toMatchObject({
    id: '1',
    serverComplaintId: 1,
    parentName: 'Demo Parent',
    studentName: 'Demo Student',
    className: '3학년 2반',
    status: 'before',
    risk: 'urgent',
    latestAt: '2026-10-29T10:42:17.437239+09:00',
    conversationSummary: { topic: '긴급 민원 테스트', text: listItem.aiSummary },
  });
  expect(toListThread({ ...listItem, waitingFor: 'PARENT' }).status).toBe('inProgress');
  expect(toListThread({ ...listItem, status: 'CLOSED', waitingFor: 'NONE' }).status).toBe('complete');
  expect(toListThread({ ...listItem, grade: null, counterpartName: null })).toMatchObject({ className: '', parentName: '학부모' });
});

test('상세·대화·위험·이력을 합쳐 위험 분류, 완충 요약, 처리 기록을 만든다', () => {
  const thread = mergeServerDetail(toListThread(listItem), bundle());
  expect(thread.replies).toEqual([expect.objectContaining({
    id: 'message:1', authorRole: 'parent', content: '완충 요약 문장', sentAt: '2026-10-29T10:42:17+09:00',
  })]);
  expect(thread.analysis).toMatchObject({
    status: 'ready',
    systemRiskLevel: 'emergency',
    canReviewRisk: true,
    packageAvailable: true,
    safetyLock: false,
    summary: { status: 'ready', text: '완충 요약 문장' },
  });
  // detectedFactors THREAT → PRESENT, every other category → ABSENT (the analysis completed).
  const classifications = thread.analysis?.riskClassifications ?? [];
  expect(classifications).toHaveLength(8);
  expect(classifications.find((item) => item.code === 'THREAT')).toMatchObject({ status: 'PRESENT', evidenceSpan: '직접 다치게 하겠습니다' });
  expect(classifications.filter((item) => item.status === 'ABSENT')).toHaveLength(7);
  // reviewScore without a latestReview is only the initial score, not a teacher review.
  expect(thread.analysis?.teacherReviewedRiskLevel).toBeUndefined();
  expect(thread.needsTeacherReview).toBe(false);
});

test('교사 검토가 있으면 검토 위험도를 쓰고, 답변 후 학부모 차례가 아니면 재확인 필요로 표시한다', () => {
  const reviewed = mergeServerDetail(toListThread(listItem), bundle({
    risk: {
      ...risk, reviewScore: 5, reviewLevel: 'HIGH', safetyLock: true,
      latestReview: { riskReviewId: 3, direction: 'LOWERED', reason: '오탐', reviewedBy: 'Demo Teacher', reviewedAt: '2026-10-29T11:00:00' },
    },
    conversation: {
      ...conversation,
      messages: [
        ...conversation.messages,
        { messageId: 'message:2', senderRole: 'TEACHER', senderName: 'Demo Teacher', content: '답변', sentAt: '2026-10-29T11:10:00', summarized: false },
        { messageId: 'message:3', senderRole: 'PARENT', senderName: 'Demo Parent', content: '추가 문의', sentAt: '2026-10-29T11:20:00', summarized: false },
      ],
    },
  }));
  expect(reviewed.analysis).toMatchObject({ teacherReviewedRiskLevel: 'high', teacherRiskScore: 5, teacherReviewReason: '오탐', safetyLock: true });
  expect(reviewed.risk).toBe('danger');
  expect(reviewed.status).toBe('inProgress');
  expect(reviewed.needsTeacherReview).toBe(true);
  expect(reviewed.replies.map((reply) => reply.authorRole)).toEqual(['parent', 'teacher', 'parent']);
});

test('위험 분석이 없으면 분석 실패로 표시하고 답변 차례가 아니면 위험도 검토를 막는다', () => {
  const thread = mergeServerDetail(toListThread(listItem), bundle({
    risk: null,
    detail: { ...bundle().detail, waitingFor: 'PARENT' },
  }));
  expect(thread.analysis).toMatchObject({ status: 'failed', canReviewRisk: false });
});

test('서버 이력은 오래된 순으로 바꾸고 생략된 필드를 비어 있는 값으로 처리한다', () => {
  expect(toActivityLogs(history)).toEqual([
    expect.objectContaining({ id: 'complaint-event:2', action: '민원 상태 변경', actor: 'Demo Parent', detail: '작성 중' }),
    expect.objectContaining({ id: 'complaint-event:3', action: '위험 분석', actor: '시스템', detail: '긴급(30점)' }),
  ]);
});

test('학부모 메시지마다 완충 요약 여부를 유지하고, 최신 문의가 요약이 아니면 이전 요약을 현재 요약으로 쓰지 않는다', () => {
  const thread = mergeServerDetail(toListThread(listItem), bundle({
    conversation: {
      ...conversation,
      messages: [
        ...conversation.messages,
        { messageId: 'message:2', senderRole: 'TEACHER', senderName: 'Demo Teacher', content: '답변', sentAt: '2026-10-29T11:10:00', summarized: false },
        { messageId: 'message:3', senderRole: 'PARENT', senderName: 'Demo Parent', content: '두 번째 문의 원문', sentAt: '2026-10-29T11:20:00', summarized: false },
      ],
    },
  }));
  expect(thread.replies.map((reply) => reply.summarized)).toEqual([true, undefined, false]);
  expect(thread.analysis?.summary.text).toBe('');
});

test('처리 기록 조회가 실패하면 기존 기록을 유지하고 실패 상태를 남긴다', () => {
  const loaded = mergeServerDetail(toListThread(listItem), bundle());
  const reloaded = mergeServerDetail(loaded, bundle({ history: null }));
  expect(reloaded.analysis?.activityLogs).toEqual(loaded.analysis?.activityLogs);
  expect(reloaded.analysis?.activityLogsUnavailable).toBe(true);
  expect(mergeServerDetail(toListThread(listItem), bundle({ history: null })).analysis?.activityLogs).toEqual([]);
});

test('목록 재조회는 서버 필드만 갱신하고 별표·상세·교사 답변 여부를 유지한다', () => {
  const opened = {
    ...mergeServerDetail(toListThread(listItem), bundle({
      conversation: {
        ...conversation,
        messages: [
          ...conversation.messages,
          { messageId: 'message:2', senderRole: 'TEACHER', senderName: 'Demo Teacher', content: '답변', sentAt: '2026-10-29T11:10:00', summarized: false },
        ],
      },
    })),
    isPinned: true,
  };
  const merged = mergeListFields(opened, toListThread({ ...listItem, title: '제목 변경', riskLevel: 'HIGH', waitingFor: 'TEACHER' }));
  expect(merged).toMatchObject({ title: '제목 변경', risk: 'danger', isPinned: true, status: 'inProgress', needsTeacherReview: true });
  expect(merged.analysis).toBe(opened.analysis);
  expect(merged.replies).toBe(opened.replies);
  expect(mergeListFields({ ...toListThread(listItem), isPinned: true }, toListThread(listItem)).isPinned).toBe(true);
});

test('상세 조회 실패는 로딩을 실패로 바꾸고, 다시 불러오면 로딩으로 돌아간다', () => {
  const loading = markServerDetailLoading(toListThread(listItem));
  expect(loading.analysis?.status).toBe('loading');
  const failed = markServerDetailFailed(loading);
  expect(failed.analysis?.status).toBe('failed');
  expect(markServerDetailLoading(failed).analysis?.status).toBe('loading');
  // A loaded analysis stays as it is during a background refresh.
  const ready = mergeServerDetail(toListThread(listItem), bundle());
  expect(markServerDetailLoading(ready)).toBe(ready);
  expect(markServerDetailFailed(ready)).toBe(ready);
});
