import { expect, test } from '@playwright/test';
import { configureApiClient } from '../../src/shared/api/apiClient';
import { appendFollowUp, applyServerComplaintState, getConversation, needsParentReview } from '../../src/features/parent-message/conversation';
import { readMessageDrafts, readSentMessages, saveMessageDraft, storeSentMessage, updateSentMessage, type MessageDraft } from '../../src/features/parent-message/messageDraft';
import type { SentParentMessage } from '../../src/features/parent-message/parentMessageTypes';
import { complaintIdFromThreadId, syncServerComplaints, syncServerConversation } from '../../src/features/parent-message/serverHistory';

// Parent history from GET /complaints, /complaints/{id}, and /complaints/{id}/messages into the browser copy
// (stubbed fetch, not the real server).

const USER_ID = 7;

test('200건 이후 페이지와 서버 검색 결과를 가져오며 임시저장만 있는 페이지는 건너뛴다', async () => {
  serve({
    'GET /complaints?page=20&keyword=reply': page([listItem(201, { status: 'DRAFT' })], 20, true),
    'GET /complaints?page=21&keyword=reply': page([listItem(211)], 21, false),
    'GET /complaints/211': detail(211),
  });
  expect(await syncServerComplaints(USER_ID, undefined, { page: 20, keyword: 'reply' })).toEqual({ complaintIds: [211], page: 21, hasNext: false });
  expect(readSentMessages(USER_ID).map((item) => item.serverComplaintId)).toEqual([211]);
  expect(requests.some((path) => path.endsWith('/messages'))).toBe(false);
});

test('취소한 검색 응답은 로컬 문의 사본에 반영하지 않는다', async () => {
  const controller = new AbortController();
  globalThis.fetch = (async () => {
    controller.abort();
    return json(page([], 0, false));
  }) as typeof fetch;
  await expect(syncServerComplaints(USER_ID, controller.signal)).rejects.toThrow();
  expect(changeEvents).toBe(0);
});
const originalFetch = globalThis.fetch;
let requests: string[] = [];
let changeEvents = 0;

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

function serve(routes: Record<string, unknown>) {
  globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const key = `${init.method ?? 'GET'} ${url.pathname}${url.search}`;
    requests.push(key);
    if (!(key in routes)) throw new Error(`Unexpected request ${key}`);
    return json(routes[key]);
  }) as typeof fetch;
}

function installStorage() {
  const values = new Map<string, string>();
  const events = new EventTarget();
  events.addEventListener('parent-messages-changed', () => { changeEvents += 1; });
  Object.assign(globalThis, {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
      removeItem: (key: string) => void values.delete(key),
      key: (index: number) => [...values.keys()][index] ?? null,
      get length() { return values.size; },
    },
    window: events,
  });
}

function page(content: unknown[], pageNumber: number, hasNext: boolean) {
  return { content, page: pageNumber, size: 10, totalElements: 0, totalPages: 0, first: pageNumber === 0, last: !hasNext, hasNext, hasPrevious: pageNumber > 0 };
}

function listItem(complaintId: number, overrides: Record<string, unknown> = {}) {
  return {
    complaintId, title: `문의 ${complaintId}`, studentId: 10, studentName: '김학생', counterpartName: '박선생',
    counterpartRole: 'TEACHER', academicYear: 2026, grade: 3, classNo: 2, status: 'OPEN', waitingFor: 'TEACHER',
    riskAnalysisId: null, riskLevel: 'LOW', aiSummary: null, latestReceivedAt: '2026-10-30T10:00:00', ...overrides,
  };
}

function detail(complaintId: number, overrides: Record<string, unknown> = {}) {
  return {
    complaintId, title: `문의 ${complaintId}`, studentId: 10, studentName: '김학생', parentName: '김학부모',
    teacherName: '박선생', content: `처음 문의 ${complaintId}`, status: 'OPEN', waitingFor: 'TEACHER', riskLevel: 'LOW',
    createdAt: '2026-10-30T09:00:00', updatedAt: '2026-10-30T09:00:00', ...overrides,
  };
}

// The copy submitServerDraft keeps after an inquiry is sent from this browser.
function localThread(overrides: Partial<SentParentMessage> = {}): SentParentMessage {
  return {
    messageId: 'local-thread', serverComplaintId: 42, teacherId: '20', teacherName: '박선생', title: '문의 42',
    originalBody: '처음 문의 42', finalBody: '처음 문의 42', selectionType: 'ORIGINAL', selectionSource: 'ORIGINAL',
    status: 'SENT', sentAt: '2026-10-30T00:00:00.000Z', auditLog: [{ action: 'SENT', at: '2026-10-30T00:00:00.000Z', selectionType: 'ORIGINAL' }],
    consultationStatus: 'before', ...overrides,
  };
}

function message(messageId: number, senderRole: 'PARENT' | 'TEACHER', content: string, sentAt: string | null, status = 'SENT') {
  return {
    messageId, type: senderRole === 'PARENT' ? 'PARENT_INQUIRY' : 'TEACHER_REPLY', senderRole,
    senderName: senderRole === 'PARENT' ? '김학부모' : '박선생', content, status, sentAt, readAt: null,
  };
}

test.beforeEach(() => {
  requests = [];
  changeEvents = 0;
  installStorage();
  configureApiClient({ baseUrl: 'https://api.test', timeoutMs: 1_000, getAccessToken: () => 'jwt', onUnauthorized: () => undefined });
});

test.afterAll(() => {
  globalThis.fetch = originalFetch;
});

test('목록 동기화는 요청한 페이지를 받아 기존 사본을 갱신하고 새 문의만 상세 조회한다', async () => {
  storeSentMessage(USER_ID, localThread());
  changeEvents = 0;
  serve({
    'GET /complaints?page=0': page([listItem(42, { waitingFor: 'PARENT' }), listItem(44, { status: 'DRAFT' })], 0, true),
    'GET /complaints?page=1': page([listItem(43, { status: 'CLOSED', waitingFor: 'NONE' })], 1, false),
    'GET /complaints/43': detail(43, { status: 'CLOSED', waitingFor: 'NONE' }),
  });

  expect(await syncServerComplaints(USER_ID)).toEqual({ complaintIds: [42], page: 0, hasNext: true });
  expect(requests).toEqual(['GET /complaints?page=0']);
  expect(await syncServerComplaints(USER_ID, undefined, { page: 1 })).toEqual({ complaintIds: [43], page: 1, hasNext: false });

  // No /messages: it would mark the teacher's reply as read before the parent opens it.
  expect(requests).toEqual(['GET /complaints?page=0', 'GET /complaints?page=1', 'GET /complaints/43']);
  expect(changeEvents).toBe(2);
  const [created, existing] = readSentMessages(USER_ID);
  expect(existing).toMatchObject({ messageId: 'local-thread', consultationStatus: 'inProgress', serverWaitingFor: 'PARENT', updatedAt: '2026-10-30T01:00:00.000Z' });
  expect(needsParentReview(existing)).toBe(true);
  expect(created).toMatchObject({
    messageId: 'server-43', serverComplaintId: 43, teacherId: '', teacherName: '박선생', title: '문의 43',
    finalBody: '처음 문의 43', consultationStatus: 'complete', sentAt: '2026-10-30T00:00:00.000Z',
  });
  expect(readSentMessages(USER_ID).some((thread) => thread.serverComplaintId === 44)).toBe(false);

  // A second sync with nothing new writes nothing.
  await syncServerComplaints(USER_ID);
  expect(changeEvents).toBe(2);
});

test('대화 동기화는 교사 답변을 넣고 학부모 메시지의 로컬 ID를 유지한다', async () => {
  storeSentMessage(USER_ID, localThread({
    conversation: [
      { id: 'local-thread', authorRole: 'parent', body: '처음 문의 42', sentAt: '2026-10-30T00:00:00.000Z' },
      { id: 'local-follow-up', serverMessageId: 102, authorRole: 'parent', body: '추가 문의', sentAt: '2026-10-30T02:00:00.000Z' },
    ],
  }));
  serve({
    'GET /complaints/42/messages': {
      complaintId: 42, status: 'OPEN', waitingFor: 'PARENT',
      messages: [
        message(101, 'PARENT', '처음 문의 42', '2026-10-30T09:00:00'),
        message(102, 'PARENT', '추가 문의', '2026-10-30T11:00:00'),
        message(103, 'TEACHER', '상담은 목요일에 가능합니다.', '2026-10-30T12:30:00'),
        message(104, 'PARENT', '작성 중', null, 'DRAFT'),
      ],
    },
  });

  await syncServerConversation(USER_ID, 42);

  expect(requests).toEqual(['GET /complaints/42/messages']);
  const [thread] = readSentMessages(USER_ID);
  expect(thread.conversation).toEqual([
    { id: 'local-thread', serverMessageId: 101, authorRole: 'parent', body: '처음 문의 42', sentAt: '2026-10-30T00:00:00.000Z' },
    { id: 'local-follow-up', serverMessageId: 102, authorRole: 'parent', body: '추가 문의', sentAt: '2026-10-30T02:00:00.000Z' },
    { id: 'server-message-103', serverMessageId: 103, authorRole: 'teacher', body: '상담은 목요일에 가능합니다.', sentAt: '2026-10-30T03:30:00.000Z' },
  ]);
  expect(thread).toMatchObject({ consultationStatus: 'inProgress', serverWaitingFor: 'PARENT', updatedAt: '2026-10-30T03:30:00.000Z' });
  expect(needsParentReview(thread)).toBe(true);
  expect(needsParentReview({ ...thread, parentAcknowledgedAt: '2026-10-30T04:00:00.000Z' })).toBe(false);
});

test('이 기기에 없는 문의 링크는 상세 조회로 사본을 만든다', async () => {
  expect(complaintIdFromThreadId('server-50')).toBe(50);
  expect(complaintIdFromThreadId('local-thread')).toBeUndefined();
  expect(complaintIdFromThreadId('server-0')).toBeUndefined();
  serve({
    'GET /complaints/50/messages': {
      complaintId: 50, status: 'CLOSED', waitingFor: 'NONE',
      messages: [message(501, 'PARENT', '처음 문의 50', '2026-10-30T09:00:00'), message(502, 'TEACHER', '답변', '2026-10-30T10:00:00')],
    },
    'GET /complaints/50': detail(50, { status: 'CLOSED', waitingFor: 'NONE' }),
  });

  await syncServerConversation(USER_ID, 50);

  const [thread] = readSentMessages(USER_ID);
  expect(thread).toMatchObject({ messageId: 'server-50', serverComplaintId: 50, consultationStatus: 'complete' });
  expect(thread.conversation?.map((entry) => [entry.id, entry.authorRole])).toEqual([['server-50', 'parent'], ['server-message-502', 'teacher']]);
});

test('서버 목록에서 온 문의의 추가 문의 초안은 교사 ID 없이도 유지된다', () => {
  saveMessageDraft(USER_ID, {
    messageId: 'follow-up-draft', teacherId: '', title: '문의 43', body: '추가 문의', status: 'PARENT_REVIEW', threadId: 'server-43',
    server: { complaintId: 43, teacherId: 0, teacherName: '박선생', title: '문의 43', content: '추가 문의', analysisId: null, serverMessageId: 301, contentVersion: 0 },
  });
  saveMessageDraft(USER_ID, {
    messageId: 'new-draft', teacherId: '', title: '새 문의', body: '내용', status: 'PARENT_REVIEW',
    server: { complaintId: 44, teacherId: 0, teacherName: '박선생', title: '새 문의', content: '내용', analysisId: null },
  });

  const drafts = readMessageDrafts(USER_ID);
  expect(drafts.find((draft) => draft.messageId === 'follow-up-draft')?.server?.serverMessageId).toBe(301);
  // A new inquiry still needs its teacher.
  expect(drafts.find((draft) => draft.messageId === 'new-draft')?.server).toBeUndefined();
});

for (const newParent of [false, true]) {
  test(`전송 분석은 ${newParent ? '다른 기기의 새 추가 문의가 오면 지운다' : '기존 문의의 교사 답변만 오면 유지한다'}`, async () => {
    const analysis = { aiAnalysisStatus: 'COMPLETED' as const, riskScore: 30, riskLevel: 'MEDIUM' as const };
    storeSentMessage(USER_ID, localThread({ submissionAnalysis: analysis }));
    serve({ 'GET /complaints/42/messages': {
      complaintId: 42, status: 'OPEN', waitingFor: newParent ? 'TEACHER' : 'PARENT', messages: [
        message(10, 'PARENT', '처음 문의 42', '2026-10-30T09:00:00'),
        message(11, 'TEACHER', '답변입니다.', '2026-10-30T09:10:00'),
        ...(newParent ? [message(12, 'PARENT', '다른 기기의 추가 문의', '2026-10-30T09:20:00')] : []),
      ],
    } });
    await syncServerConversation(USER_ID, 42);
    expect(readSentMessages(USER_ID)[0].submissionAnalysis).toEqual(newParent ? undefined : analysis);
  });
}

function followUpDraft(): MessageDraft {
  return {
    messageId: 'local-follow-up', threadId: 'local-thread', teacherId: '20', title: '문의 42',
    body: '추가 문의', status: 'PARENT_REVIEW',
  };
}

function followUpSubmission(overrides: Partial<SentParentMessage> = {}): SentParentMessage {
  return localThread({
    messageId: 'local-follow-up', serverMessageId: 103,
    originalBody: '추가 문의', finalBody: '추가 문의', sentAt: '2026-10-30T01:00:00.000Z',
    auditLog: [{ action: 'SENT', at: '2026-10-30T01:00:00.000Z', selectionType: 'ORIGINAL' }],
    ...overrides,
  });
}

test('지연된 대화 응답은 조회 중 전송한 최신 문의와 분석을 되돌리지 않는다', async () => {
  const analysis = { aiAnalysisStatus: 'RULE_ONLY_AI_UNAVAILABLE' as const, manualReviewRequired: true, riskScore: 40, riskLevel: 'MEDIUM' as const };
  storeSentMessage(USER_ID, localThread({ conversation: [
    { id: 'local-thread', serverMessageId: 101, authorRole: 'parent', body: '처음 문의 42', sentAt: '2026-10-30T00:00:00.000Z' },
    { id: 'teacher-reply', serverMessageId: 102, authorRole: 'teacher', body: '답변입니다.', sentAt: '2026-10-30T00:30:00.000Z' },
  ] }));
  let release!: (response: Response) => void;
  const pendingResponse = new Promise<Response>((resolve) => { release = resolve; });
  globalThis.fetch = (() => pendingResponse) as typeof fetch;
  const syncing = syncServerConversation(USER_ID, 42);
  appendFollowUp(USER_ID, followUpDraft(), followUpSubmission({ submissionAnalysis: analysis }));
  const latest = readSentMessages(USER_ID)[0];
  release(new Response(JSON.stringify({ complaintId: 42, status: 'OPEN', waitingFor: 'PARENT', messages: [
    message(101, 'PARENT', '처음 문의 42', '2026-10-30T09:00:00'),
    message(102, 'TEACHER', '답변입니다.', '2026-10-30T09:30:00'),
  ] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  await syncing;

  expect(readSentMessages(USER_ID)[0]).toEqual(latest);
});

test('지연된 대화 응답은 이미 동기화한 교사 답변과 상담 상태도 되돌리지 않는다', async () => {
  const latest = localThread({ consultationStatus: 'complete', serverWaitingFor: 'NONE', conversation: [
    { id: 'local-thread', serverMessageId: 101, authorRole: 'parent', body: '처음 문의 42', sentAt: '2026-10-30T00:00:00.000Z' },
    { id: 'teacher-reply', serverMessageId: 102, authorRole: 'teacher', body: '답변입니다.', sentAt: '2026-10-30T00:00:00.000Z' },
  ] });
  storeSentMessage(USER_ID, latest);
  serve({ 'GET /complaints/42/messages': { complaintId: 42, status: 'OPEN', waitingFor: 'TEACHER', messages: [
    message(101, 'PARENT', '처음 문의 42', '2026-10-30T09:00:00'),
  ] } });
  await syncServerConversation(USER_ID, 42);

  expect(readSentMessages(USER_ID)[0]).toEqual(latest);
});

test('문의 완료 전에 시작한 대화 조회가 같은 메시지를 반환해도 완료 상태를 되돌리지 않는다', async () => {
  const answered = localThread({ serverComplaintStatus: 'ANSWERED', serverWaitingFor: 'PARENT', consultationStatus: 'inProgress' });
  storeSentMessage(USER_ID, answered);
  let release!: (response: Response) => void;
  const pendingResponse = new Promise<Response>((resolve) => { release = resolve; });
  globalThis.fetch = (() => pendingResponse) as typeof fetch;
  const syncing = syncServerConversation(USER_ID, 42);
  updateSentMessage(USER_ID, answered.messageId, (current) => applyServerComplaintState(current, { status: 'CLOSED', waitingFor: 'NONE' }));
  release(json({ complaintId: 42, status: 'ANSWERED', waitingFor: 'PARENT', messages: [
    message(101, 'PARENT', answered.finalBody, '2026-10-30T09:00:00'),
    { ...message(102, 'TEACHER', '답변입니다.', '2026-10-30T09:30:00', 'READ'), readAt: '2026-10-30T10:00:00' },
  ] }));
  await syncing;

  expect(readSentMessages(USER_ID)[0]).toMatchObject({
    serverComplaintStatus: 'CLOSED', serverWaitingFor: 'NONE', consultationStatus: 'complete',
    parentAcknowledgedAt: '2026-10-30T01:00:00.000Z',
  });
});

for (const identity of ['local', 'server'] as const) {
  test(`중복 ${identity} ID의 최신 전송 응답은 메시지를 늘리지 않고 분석을 저장한다`, async () => {
    const oldAnalysis = { aiAnalysisStatus: 'COMPLETED' as const, riskScore: 10, riskLevel: 'LOW' as const };
    storeSentMessage(USER_ID, localThread({ submissionAnalysis: oldAnalysis }));
    serve({ 'GET /complaints/42/messages': { complaintId: 42, status: 'OPEN', waitingFor: 'TEACHER', messages: [
      message(101, 'PARENT', '처음 문의 42', '2026-10-30T09:00:00'),
      message(102, 'TEACHER', '답변입니다.', '2026-10-30T09:30:00'),
      message(103, 'PARENT', '추가 문의', '2026-10-30T10:00:00'),
      message(104, 'TEACHER', '추가 답변입니다.', '2026-10-30T10:10:00'),
    ] } });
    await syncServerConversation(USER_ID, 42);
    const synced = readSentMessages(USER_ID)[0];
    expect(synced.submissionAnalysis).toBeUndefined();
    const analysis = { aiAnalysisStatus: 'REUSED_RULE_ONLY' as const, manualReviewRequired: true, riskScore: 40, riskLevel: 'MEDIUM' as const };
    const draft = { ...followUpDraft(), ...(identity === 'local' ? { messageId: 'server-message-103' } : {}) };
    const result = appendFollowUp(USER_ID, draft, followUpSubmission({ submissionAnalysis: analysis }));

    expect(result).toEqual({ ...synced, submissionAnalysis: analysis });
    expect(getConversation(result)).toHaveLength(4);
    expect(readSentMessages(USER_ID)[0].submissionAnalysis).toEqual(analysis);
  });
}

test('중복된 과거 전송 응답은 같은 문장의 최신 문의 분석을 바꾸지 않는다', () => {
  const analysis = { aiAnalysisStatus: 'COMPLETED' as const, riskScore: 80, riskLevel: 'HIGH' as const };
  const latest = localThread({ submissionAnalysis: analysis, conversation: [
    { id: 'local-thread', serverMessageId: 101, authorRole: 'parent', body: '처음 문의 42', sentAt: '2026-10-30T00:00:00.000Z' },
    { id: 'local-follow-up', serverMessageId: 103, authorRole: 'parent', body: '추가 문의', sentAt: '2026-10-30T01:00:00.000Z' },
    { id: 'newer-follow-up', serverMessageId: 105, authorRole: 'parent', body: '추가 문의', sentAt: '2026-10-30T02:00:00.000Z' },
  ] });
  storeSentMessage(USER_ID, latest);
  const result = appendFollowUp(USER_ID, followUpDraft(), followUpSubmission({ submissionAnalysis: {
    aiAnalysisStatus: 'RULE_ONLY_AI_UNAVAILABLE', manualReviewRequired: true, riskScore: 40, riskLevel: 'MEDIUM',
  } }));

  expect(result).toEqual(latest);
});

test('중복 전송 복구 응답에 분석이 없으면 이미 확인한 분석을 보존한다', () => {
  const analysis = { aiAnalysisStatus: 'COMPLETED' as const, riskScore: 80, riskLevel: 'HIGH' as const };
  const latest = localThread({ submissionAnalysis: analysis, conversation: [
    { id: 'local-thread', serverMessageId: 101, authorRole: 'parent', body: '처음 문의 42', sentAt: '2026-10-30T00:00:00.000Z' },
    { id: 'local-follow-up', serverMessageId: 103, authorRole: 'parent', body: '추가 문의', sentAt: '2026-10-30T01:00:00.000Z' },
  ] });
  storeSentMessage(USER_ID, latest);

  expect(appendFollowUp(USER_ID, followUpDraft(), followUpSubmission())).toEqual(latest);
});

test('중복된 최신 전송의 SKIPPED_LIMIT은 이전 점수를 되살리지 않는다', () => {
  storeSentMessage(USER_ID, localThread());
  appendFollowUp(USER_ID, followUpDraft(), followUpSubmission({ submissionAnalysis: {
    aiAnalysisStatus: 'COMPLETED', riskScore: 80, riskLevel: 'HIGH',
  } }));
  const result = appendFollowUp(USER_ID, followUpDraft(), followUpSubmission({ submissionAnalysis: {
    aiAnalysisStatus: 'SKIPPED_LIMIT',
  } }));

  expect(result.submissionAnalysis).toEqual({ aiAnalysisStatus: 'SKIPPED_LIMIT' });
  expect(getConversation(result)).toHaveLength(2);
});
