import { expect, test } from '@playwright/test';
import { configureApiClient } from '../../src/shared/api/apiClient';
import { getApiErrorMessage, toApiError } from '../../src/shared/api/apiError';
import { httpTeacherInboxApi } from '../../src/features/message/api/httpTeacherInboxApi';
import type {
  TeacherResponseDraftResponse,
  TeacherResponseSubmissionResponse,
} from '../../src/features/message/api/teacherInboxTypes';
import { getReplyDraftTab, selectReplyDraft } from '../../src/features/message/replyDrafts';
import {
  applyServerSubmission,
  getServerReplyBlockReason,
  markServerDraftSaved,
  restoreServerDraft,
  setReplyDraftTabState,
} from '../../src/features/message/serverReplies';
import type { BoardThread } from '../../src/features/message/types';

// Request paths and bodies against the backend teacher reply endpoints (stubbed fetch, not the real server)
// and the mapping between the composer's per-tab drafts and the server's single draft.

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

function thread(overrides: Partial<BoardThread> = {}): BoardThread {
  return {
    id: '7',
    serverComplaintId: 7,
    serverStatus: { status: 'OPEN', waitingFor: 'TEACHER' },
    title: '상담 일정 문의',
    parentName: 'Demo Parent',
    studentName: 'Demo Student',
    className: '3학년 2반',
    latestAt: '2026-10-29T10:00:00+09:00',
    latestAtLabel: '',
    latestMessage: '',
    status: 'before',
    risk: 'normal',
    riskReviewRequired: false,
    isPinned: false,
    draftText: '',
    replies: [],
    ...overrides,
  };
}

const serverDraft: TeacherResponseDraftResponse = {
  responseDraftId: 31,
  complaintId: 7,
  content: '서버에 저장한 답변',
  createdAt: '2026-10-29T10:10:00',
  updatedAt: '2026-10-29T10:12:00',
};

test.beforeEach(() => {
  calls = [];
  configureApiClient({ baseUrl: 'https://api.test', timeoutMs: 1_000, getAccessToken: () => 'jwt', onUnauthorized: () => undefined });
});

test.afterAll(() => {
  globalThis.fetch = originalFetch;
});

test('교사 답변 API는 백엔드 경로와 content 본문을 사용한다', async () => {
  mockFetch(() => json(200, {}));

  await httpTeacherInboxApi.generateAiDraft(7);
  await httpTeacherInboxApi.getResponseDraft(7);
  await httpTeacherInboxApi.saveResponseDraft(7, { content: '임시저장 답변' });
  await httpTeacherInboxApi.submitResponse(7, { content: '최종 답변' });

  expect(calls.map((call) => `${call.init.method} ${call.url.replace('https://api.test', '')}`)).toEqual([
    'POST /teacher/complaints/7/response/ai-draft',
    'GET /teacher/complaints/7/response-draft',
    'PUT /teacher/complaints/7/response-draft',
    'POST /teacher/complaints/7/responses',
  ]);
  expect(calls.map((call) => call.init.body ?? null)).toEqual([
    null,
    null,
    JSON.stringify({ content: '임시저장 답변' }),
    JSON.stringify({ content: '최종 답변' }),
  ]);
});

test('답변할 수 없는 상태의 409와 초안 없음 404를 구분해 안내한다', async () => {
  mockFetch((call) => call.init.method === 'GET'
    ? json(404, { status: 404, code: 'RESPONSE_DRAFT_NOT_FOUND', message: '저장된 답변 초안을 찾을 수 없습니다.' })
    : json(409, { status: 409, code: 'RESPONSE_NOT_EDITABLE', message: '접수되어 답변 대기 중인 민원만 답변할 수 있습니다.' }));

  const notFound = await httpTeacherInboxApi.getResponseDraft(7).then(() => null, toApiError);
  const notEditable = await httpTeacherInboxApi.submitResponse(7, { content: '답변' }).then(() => null, toApiError);

  expect(notFound?.code).toBe('RESPONSE_DRAFT_NOT_FOUND');
  expect(notEditable?.code).toBe('RESPONSE_NOT_EDITABLE');
  expect(getApiErrorMessage(notEditable)).toContain('지금은 답변할 수 없는 문의');
});

test('서버가 답변을 받는 상태(OPEN·교사 차례)가 아니면 작성·전송을 막는다', () => {
  expect(getServerReplyBlockReason(thread())).toBeNull();
  expect(getServerReplyBlockReason(thread({ serverStatus: undefined }))).toBeNull();
  expect(getServerReplyBlockReason(thread({ serverStatus: { status: 'OPEN', waitingFor: 'PARENT' } })))
    .toContain('학부모의 답장을 기다리는 중');
  expect(getServerReplyBlockReason(thread({ serverStatus: { status: 'CLOSED', waitingFor: 'NONE' } })))
    .toContain('완료된 상담');
});

test('서버 초안은 로컬 탭이 비어 있을 때만 직접 작성 탭으로 복원한다', () => {
  const restored = restoreServerDraft(thread(), serverDraft);
  expect(getReplyDraftTab(restored)).toBe('manual');
  expect(restored.draftText).toBe('서버에 저장한 답변');
  expect(restored.draftSavedAt).toBeTruthy();
  expect(restored.serverDraftChecked).toBe(true);

  // A draft written in this session is newer than the server copy.
  const local = restoreServerDraft(thread({ draftText: '작성 중', replyDraftTab: 'ai' }), serverDraft);
  expect(local.draftText).toBe('작성 중');
  expect(getReplyDraftTab(local)).toBe('ai');
  expect(local.serverDraftChecked).toBe(true);

  // No saved draft still marks the check, so a cleared tab is not refilled on the next entry.
  expect(restoreServerDraft(thread(), null)).toMatchObject({ draftText: '', serverDraftChecked: true });
});

test('임시저장하면 현재 탭만 저장 표시를 남기고 다른 탭의 저장 표시를 지운다', () => {
  const aiSaved = selectReplyDraft(
    thread({ draftText: 'AI 초안', draftSavedAt: '이전 저장', aiDraftGenerated: true, replyDraftTab: 'ai' }),
    'manual',
  );
  const manual = { ...aiSaved, draftText: '직접 쓴 답변' };

  const saved = markServerDraftSaved(manual, serverDraft);

  expect(saved.draftSavedAt).toBeTruthy();
  expect(saved.replyDrafts?.ai?.draftText).toBe('AI 초안');
  expect(saved.replyDrafts?.ai?.draftSavedAt).toBeUndefined();
});

test('AI 초안은 화면에 없는 AI 탭에도 채울 수 있다', () => {
  const onManual = selectReplyDraft(thread({ replyDraftTab: 'ai' }), 'manual');
  const filled = setReplyDraftTabState(onManual, 'ai', { draftText: 'AI 응답', aiDraftGenerated: true });
  expect(getReplyDraftTab(filled)).toBe('manual');
  expect(filled.replyDrafts?.ai).toEqual({ draftText: 'AI 응답', aiDraftGenerated: true });

  const onAi = setReplyDraftTabState(thread({ replyDraftTab: 'ai' }), 'ai', { draftText: 'AI 응답', aiDraftGenerated: true });
  expect(onAi.draftText).toBe('AI 응답');
  expect(onAi.aiDraftGenerated).toBe(true);
});

test('전송 응답으로 답변을 대화에 붙이고 학부모 차례로 바꾼다', () => {
  const response: TeacherResponseSubmissionResponse = {
    responseId: 55,
    complaintId: 7,
    content: '확인 후 안내드리겠습니다.',
    complaintStatus: 'OPEN',
    waitingFor: 'PARENT',
    sentAt: '2026-10-29T10:20:00',
  };
  const sent = applyServerSubmission(
    thread({ draftText: '확인 후 안내드리겠습니다.', replyDraftTab: 'manual', replyDrafts: { ai: { draftText: 'AI' } } }),
    response,
    'Demo Teacher',
  );

  expect(sent.serverStatus).toEqual({ status: 'OPEN', waitingFor: 'PARENT' });
  expect(sent.status).toBe('inProgress');
  expect(sent.draftText).toBe('');
  expect(sent.replyDrafts).toBeUndefined();
  expect(sent.replies.at(-1)).toMatchObject({
    id: 'message:55',
    authorRole: 'teacher',
    content: '확인 후 안내드리겠습니다.',
    sentAt: '2026-10-29T10:20:00+09:00',
  });
  expect(getServerReplyBlockReason(sent)).not.toBeNull();
});
