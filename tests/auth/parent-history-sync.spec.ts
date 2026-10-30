import { expect, test } from '@playwright/test';
import { configureApiClient } from '../../src/shared/api/apiClient';
import { needsParentReview } from '../../src/features/parent-message/conversation';
import { readMessageDrafts, readSentMessages, saveMessageDraft, storeSentMessage } from '../../src/features/parent-message/messageDraft';
import type { SentParentMessage } from '../../src/features/parent-message/parentMessageTypes';
import { complaintIdFromThreadId, syncServerComplaints, syncServerConversation } from '../../src/features/parent-message/serverHistory';

// Parent history from GET /complaints, /complaints/{id}, and /complaints/{id}/messages into the browser copy
// (stubbed fetch, not the real server).

const USER_ID = 7;
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

test('목록 동기화는 모든 페이지를 받아 기존 사본을 갱신하고 새 문의만 상세 조회한다', async () => {
  storeSentMessage(USER_ID, localThread());
  changeEvents = 0;
  serve({
    'GET /complaints?page=0': page([listItem(42, { waitingFor: 'PARENT' }), listItem(44, { status: 'DRAFT' })], 0, true),
    'GET /complaints?page=1': page([listItem(43, { status: 'CLOSED', waitingFor: 'NONE' })], 1, false),
    'GET /complaints/43': detail(43, { status: 'CLOSED', waitingFor: 'NONE' }),
  });

  await syncServerComplaints(USER_ID);

  // No /messages: it would mark the teacher's reply as read before the parent opens it.
  expect(requests).toEqual(['GET /complaints?page=0', 'GET /complaints?page=1', 'GET /complaints/43']);
  expect(changeEvents).toBe(1);
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
  expect(changeEvents).toBe(1);
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
