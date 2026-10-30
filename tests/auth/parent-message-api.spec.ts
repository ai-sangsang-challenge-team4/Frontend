import { expect, test } from '@playwright/test';
import { configureApiClient } from '../../src/shared/api/apiClient';
import { getApiErrorMessage, toApiError } from '../../src/shared/api/apiError';
import { httpParentComplaintApi } from '../../src/features/parent-message/api/httpParentComplaintApi';
import type { RiskRevisionResponse } from '../../src/features/parent-message/api/parentComplaintTypes';
import type { MessageDraft, ServerComplaintDraft } from '../../src/features/parent-message/messageDraft';
import { createMessageReview, getSelectedMessage } from '../../src/features/parent-message/parentMessageTypes';
import { detectionConfidence, detectionEvidence, detectionState } from '../../src/features/parent-message/riskDetectorResults';
import {
  analyzeServerDraft,
  listServerChildren,
  submitServerDraft,
  toServerAnalysis,
  toServerRecipients,
} from '../../src/features/parent-message/serverComplaint';

// Request paths and bodies against the backend parent complaint and risk endpoints (stubbed fetch, not the
// real server), the findings → review mapping, and the draft → analysis → submit sequence.

type FetchCall = { url: string; method: string; body: unknown };

const originalFetch = globalThis.fetch;
let calls: FetchCall[] = [];

function mockFetch(handler: (call: FetchCall) => Response) {
  globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const call = { url: String(input), method: init.method ?? 'GET', body: init.body ? JSON.parse(String(init.body)) : undefined };
    calls.push(call);
    return handler(call);
  }) as typeof fetch;
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function route(routes: Record<string, () => Response>) {
  return (call: FetchCall) => {
    const key = `${call.method} ${new URL(call.url).pathname}`;
    const respond = routes[key] ?? (key === 'GET /risk-tags' ? () => json(200, []) : undefined) ?? (key === 'POST /complaints/42/mask'
      ? () => json(200, { complaintId: 42, contentVersion: 1, maskedContent: server().content }) : undefined);
    if (!respond) throw new Error(`Unexpected request ${key}`);
    return respond();
  };
}

function rejection(promise: Promise<unknown>) {
  return promise.then(() => { throw new Error('Expected the request to fail'); }, toApiError);
}

// submitServerDraft keeps a local copy in browser storage.
function installStorage() {
  const values = new Map<string, string>();
  Object.assign(globalThis, {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
      removeItem: (key: string) => void values.delete(key),
      key: (index: number) => [...values.keys()][index] ?? null,
      get length() { return values.size; },
    },
    window: new EventTarget(),
  });
  return values;
}

const target = { studentId: 10, teacherId: 20, teacherName: 'Demo Teacher' };

function draft(overrides: Partial<MessageDraft> = {}): MessageDraft {
  return {
    messageId: 'local-1',
    teacherId: '20',
    studentId: 10,
    title: '상담 일정 문의 010-1234-5678',
    body: '상담 가능한 시간을 알려 주세요. 연락은 parent@example.com 으로 부탁드립니다.',
    status: 'DRAFT',
    ...overrides,
  };
}

function server(overrides: Partial<ServerComplaintDraft> = {}): ServerComplaintDraft {
  return {
    ...target,
    complaintId: 42,
    title: '상담 일정 문의 [전화번호]',
    content: '상담 가능한 시간을 알려 주세요. 연락은 [이메일] 으로 부탁드립니다.',
    analysisId: 7,
    contentVersion: 1,
    ...overrides,
  };
}

const findings: RiskRevisionResponse = {
  findings: [
    {
      code: 'LEGAL',
      evidences: ['교육청에 민원을 넣겠습니다'],
      revisionSuggestions: [{
        originalExpression: '교육청에 민원을 넣겠습니다',
        suggestedExpression: '빠른 확인을 부탁드립니다',
        reason: '공식 절차 언급은 압박으로 받아들여질 수 있습니다.',
      }],
    },
    { code: 'REPEAT', evidences: ['또 연락드립니다', '몇 번째인지'], revisionSuggestions: [] },
  ],
  finalRevision: { reason: '[MOCK] 수정안', content: '빠른 확인을 부탁드립니다.' },
};

test.beforeEach(() => {
  calls = [];
  configureApiClient({ baseUrl: 'https://api.test', timeoutMs: 1_000, getAccessToken: () => 'jwt', onUnauthorized: () => undefined });
});

test.afterAll(() => {
  globalThis.fetch = originalFetch;
});

test('학부모 문의 API는 백엔드 경로·메서드·본문을 사용한다', async () => {
  mockFetch(() => json(200, {}));
  await httpParentComplaintApi.listComplaints({ page: 1, keyword: ' 상담 ', status: 'OPEN', sort: 'OLDEST' });
  await httpParentComplaintApi.getComplaint(42);
  await httpParentComplaintApi.listRecipients(10);
  await httpParentComplaintApi.createDraft({ studentId: 10, teacherId: 20, title: '제목', content: '내용' });
  await httpParentComplaintApi.updateDraft(42, { content: '수정' });
  await httpParentComplaintApi.analyze(42);
  await httpParentComplaintApi.getFindings(7);
  await httpParentComplaintApi.submit(42);
  await httpParentComplaintApi.getStatus(42);
  await httpParentComplaintApi.mask(42);
  await httpParentComplaintApi.getDetectorResults(7);
  await httpParentComplaintApi.saveFollowUpDraft(42, { content: '추가 문의', expectedContentVersion: 3 });
  await httpParentComplaintApi.getFollowUpDraft(42);
  await httpParentComplaintApi.analyzeFollowUp(42, 101);
  await httpParentComplaintApi.submitFollowUp(42, 101, { expectedContentVersion: 3 });
  await httpParentComplaintApi.getConversation(42);

  expect(calls.map(({ method, url, body }) => [method, url.replace('https://api.test', ''), body])).toEqual([
    ['GET', `/complaints?page=1&keyword=${encodeURIComponent('상담')}&status=OPEN&sort=OLDEST`, undefined],
    ['GET', '/complaints/42', undefined],
    ['GET', '/complaints/recipients?studentId=10', undefined],
    ['POST', '/complaints', { studentId: 10, teacherId: 20, title: '제목', content: '내용' }],
    ['PATCH', '/complaints/42', { content: '수정' }],
    ['POST', '/complaints/42/risk-analysis', undefined],
    ['GET', '/risk-analyses/7/findings', undefined],
    ['POST', '/complaints/42/send', undefined],
    ['GET', '/complaints/42/status', undefined],
    ['POST', '/complaints/42/mask', undefined],
    ['GET', '/risk-analyses/7/detector-results', undefined],
    ['PUT', '/complaints/42/message-draft', { content: '추가 문의', expectedContentVersion: 3 }],
    ['GET', '/complaints/42/message-draft', undefined],
    ['POST', '/complaints/42/messages/101/risk-analysis', undefined],
    ['POST', '/complaints/42/messages/101/send', { expectedContentVersion: 3 }],
    ['GET', '/complaints/42/messages', undefined],
  ]);
});

test('자녀 목록은 GET /users/me의 연결된 학생에서 가져온다', async () => {
  mockFetch(() => json(200, {
    userId: 1, email: 'parent@test.com', name: 'Demo Parent', role: 'PARENT',
    students: [{ studentId: 10, name: '김하나', studentNo: '7' }, { studentId: 11, name: '김두리', studentNo: '8' }],
  }));

  expect(await listServerChildren()).toEqual([
    { studentId: 10, studentName: '김하나' },
    { studentId: 11, studentName: '김두리' },
  ]);
  expect(calls.map(({ method, url }) => [method, url.replace('https://api.test', '')])).toEqual([['GET', '/users/me']]);

  // A parent without a linked child (or a response without students) has no child to choose.
  mockFetch(() => json(200, { userId: 1, email: 'parent@test.com', name: 'Demo Parent', role: 'PARENT' }));
  expect(await listServerChildren()).toEqual([]);
});

test('수신 교사는 담임 표시를 붙인 선택지로 바뀐다', () => {
  expect(toServerRecipients([
    { teacherId: 20, teacherName: '김담임', homeroomTeacher: true },
    { teacherId: 21, teacherName: '이교과', homeroomTeacher: false },
  ]).map((teacher) => teacher.label)).toEqual(['김담임 선생님 (담임)', '이교과 선생님']);
});

test('findings는 태그별 근거·수정 제안과 최종 수정안으로 바뀐다', () => {
  const analysis = toServerAnalysis(findings, '원문');
  expect(analysis.status).toBe('ready');
  expect(analysis.revisedText).toBe('빠른 확인을 부탁드립니다.');
  expect(analysis.meaningWarning).not.toBeNull();
  expect(analysis.risks).toEqual([
    {
      id: 'LEGAL-0', kind: 'official', title: '법적 조치 언급', excerpt: '교육청에 민원을 넣겠습니다',
      explanation: '공식 절차 언급은 압박으로 받아들여질 수 있습니다.', suggestion: '빠른 확인을 부탁드립니다',
    },
    expect.objectContaining({ id: 'REPEAT-0', kind: 'repeat', title: '반복 민원', excerpt: '또 연락드립니다' }),
    expect.objectContaining({ id: 'REPEAT-1', excerpt: '몇 번째인지' }),
  ]);
  expect(analysis.risks[1]).not.toHaveProperty('suggestion');

  // The server joins a tag's evidence lines into one suggestion; each line keeps it, without a joined entry.
  const joined = toServerAnalysis({ findings: [{
    code: 'THREAT',
    evidences: ['규칙 근거', 'LLM 근거'],
    revisionSuggestions: [{ originalExpression: '규칙 근거\nLLM 근거', suggestedExpression: '확인 부탁드립니다', reason: '위협으로 읽힐 수 있습니다.' }],
  }], finalRevision: null }, '원문');
  expect(joined.risks.map((risk) => [risk.excerpt, risk.suggestion, risk.explanation])).toEqual([
    ['규칙 근거', '확인 부탁드립니다', '위협으로 읽힐 수 있습니다.'],
    ['LLM 근거', '확인 부탁드립니다', '위협으로 읽힐 수 있습니다.'],
  ]);

  // A revision equal to the analyzed content is no AI draft.
  expect(toServerAnalysis({ findings: [], finalRevision: { reason: '', content: '원문' } }, '원문').revisedText).toBeNull();
  expect(toServerAnalysis({ findings: [], finalRevision: null }, '원문').revisedText).toBeNull();
});

test('첫 분석은 마스킹한 제목·본문으로 서버 초안을 만든 뒤 분석하고 수정안을 불러온다', async () => {
  mockFetch(route({
    'POST /complaints': () => json(201, { complaintId: 42, status: 'DRAFT', waitingFor: 'TEACHER' }),
    'POST /complaints/42/risk-analysis': () => json(200, { analysisId: 7, complaintId: 42, riskScore: 3, riskLevel: 'MEDIUM' }),
    'GET /risk-analyses/7/findings': () => json(200, findings),
  }));
  const persisted: ServerComplaintDraft[] = [];

  const result = await analyzeServerDraft(draft(), target, (value) => persisted.push(value), new AbortController().signal);

  expect(calls[0].body).toEqual({
    studentId: 10, teacherId: 20,
    title: '상담 일정 문의 [전화번호]',
    content: '상담 가능한 시간을 알려 주세요. 연락은 [이메일] 으로 부탁드립니다.',
  });
  expect(calls.map((call) => call.method)).toEqual(['POST', 'POST', 'POST', 'GET', 'GET']);
  expect(calls.at(-1)?.url).toBe('https://api.test/risk-tags');
  expect(persisted.map((value) => value.analysisId)).toEqual([null, 7]);
  expect(result.server).toEqual(server());
  expect(result.analysis.risks).toHaveLength(3);
});

test('분석 후 본문을 바꾸면 PATCH하고, 서버가 재분석을 막으면 제출 시 분석으로 넘긴다', async () => {
  mockFetch(route({
    'PATCH /complaints/42': () => json(200, { message: '민원 내용이 수정되었습니다.' }),
    'POST /complaints/42/risk-analysis': () => json(409, { code: 'FINAL_ANALYSIS_ON_SUBMIT', message: '최종 분석은 제출 시 진행됩니다.' }),
  }));
  const persisted: ServerComplaintDraft[] = [];

  const result = await analyzeServerDraft(draft({ body: '바꾼 본문', server: server() }), target, (value) => persisted.push(value), new AbortController().signal);

  expect(calls.map((call) => `${call.method} ${new URL(call.url).pathname}`)).toEqual([
    'PATCH /complaints/42', 'POST /complaints/42/mask', 'POST /complaints/42/risk-analysis',
  ]);
  expect(calls[0].body).toEqual({ content: '바꾼 본문' });
  expect(persisted).toEqual([server({ content: '바꾼 본문' })]);
  expect(result.analysis).toMatchObject({ status: 'ready', revisedText: null, risks: [], meaningWarning: null, analyzeOnSubmit: true });
});

test('수정안 조회가 실패해도 저장된 분석으로 제출할 수 있게 실패 상태로 넘긴다', async () => {
  mockFetch(route({
    'POST /complaints/42/risk-analysis': () => json(200, { analysisId: 8, complaintId: 42, riskScore: 1, riskLevel: 'LOW' }),
    'GET /risk-analyses/8/findings': () => json(500, { code: 'INTERNAL_SERVER_ERROR', message: '서버 내부 오류가 발생했습니다.' }),
  }));
  const result = await analyzeServerDraft(draft({ body: server().content, server: server({ analysisId: null }) }), target, () => undefined, new AbortController().signal);

  expect(result.server.analysisId).toBe(8);
  expect(result.analysis.status).toBe('failed');
});

test('수신 교사 오류와 분석 상태 오류는 서버 코드 문구로 안내한다', async () => {
  mockFetch(() => json(400, { code: 'INVALID_COMPLAINT_RECIPIENT', message: '학생의 담당 교사에게만 문의를 보낼 수 있습니다.' }));
  const error = await rejection(analyzeServerDraft(draft(), target, () => undefined, new AbortController().signal));
  expect(error.code).toBe('INVALID_COMPLAINT_RECIPIENT');
  expect(getApiErrorMessage(error)).toContain('받는 선생님을 다시 선택');

  // These 409 codes have their own copy instead of the raw server message.
  for (const code of ['ANALYSIS_REQUIRED', 'FINAL_ANALYSIS_ON_SUBMIT', 'REANALYSIS_LIMIT_REACHED', 'COMPLAINT_NOT_DRAFT']) {
    mockFetch(() => json(409, { code, message: 'server' }));
    expect(getApiErrorMessage(await rejection(httpParentComplaintApi.submit(42))), code).not.toBe('server');
  }
});

test('선택한 문장이 서버 내용과 다르면 PATCH 후 제출하고 로컬 사본을 남긴다', async () => {
  const storage = installStorage();
  mockFetch(route({
    'PATCH /complaints/42': () => json(200, { message: '민원 내용이 수정되었습니다.' }),
    'POST /complaints/42/send': () => json(200, { message: '민원이 제출되었습니다.' }),
  }));
  const review = createMessageReview(toServerAnalysis(findings, server().content));

  const sent = await submitServerDraft(101, draft({ server: server(), status: 'PARENT_REVIEW', review }), review, new AbortController().signal, 'Demo Parent');

  expect(calls.map((call) => `${call.method} ${new URL(call.url).pathname}`)).toEqual(['PATCH /complaints/42', 'POST /complaints/42/send']);
  expect(calls[0].body).toEqual({ content: '빠른 확인을 부탁드립니다.' });
  expect(sent).toMatchObject({
    messageId: 'local-1', serverComplaintId: 42, teacherId: '20', teacherName: 'Demo Teacher',
    title: '상담 일정 문의 [전화번호]', finalBody: '빠른 확인을 부탁드립니다.', selectionType: 'AI', status: 'SENT',
  });
  expect(JSON.parse(storage.get('teacher-hub.parent-sent-messages.101')!)).toHaveLength(1);

  // A second submit of the same draft returns the stored copy without another request.
  calls = [];
  expect(await submitServerDraft(101, draft({ server: server() }), review, new AbortController().signal)).toMatchObject({ serverComplaintId: 42 });
  expect(calls).toHaveLength(0);
});

test('응답을 놓친 재시도에서 이미 제출된 민원이면 성공으로 처리한다', async () => {
  installStorage();
  mockFetch(route({
    'POST /complaints/42/send': () => json(409, { code: 'COMPLAINT_NOT_DRAFT', message: '이미 제출된 민원입니다.' }),
    'GET /complaints/42/status': () => json(200, { complaintId: 42, status: 'OPEN', waitingFor: 'TEACHER' }),
  }));
  const review = { ...createMessageReview(toServerAnalysis(findings, server().content)), source: 'ORIGINAL' as const };

  const sent = await submitServerDraft(101, draft({ body: server().content, server: server() }), review, new AbortController().signal);

  expect(calls.map((call) => call.method)).toEqual(['POST', 'GET']);
  expect(sent.selectionType).toBe('ORIGINAL');
});

test('아직 DRAFT인 민원의 제출 오류는 그대로 돌려준다', async () => {
  installStorage();
  mockFetch(route({
    'POST /complaints/42/send': () => json(409, { code: 'ANALYSIS_REQUIRED', message: 'AI 검토가 필요합니다.' }),
  }));
  const review = { ...createMessageReview(toServerAnalysis(findings, server().content)), source: 'ORIGINAL' as const };

  const error = await rejection(submitServerDraft(101, draft({ body: server().content, server: server() }), review, new AbortController().signal));

  expect(error.code).toBe('ANALYSIS_REQUIRED');
  expect(getApiErrorMessage(error)).toBe('AI 분석과 수정안 확인을 마친 후 제출해 주세요.');
});

test('서버 마스킹이 실패하면 분석을 시작하지 않고, 성공 응답의 점수와 수정 이유를 유지한다', async () => {
  mockFetch(route({ 'POST /complaints/42/mask': () => json(500, { code: 'INTERNAL_SERVER_ERROR' }) }));
  await expect(analyzeServerDraft(draft({ body: server().content, server: server() }), target, () => undefined, new AbortController().signal)).rejects.toMatchObject({ status: 500 });
  expect(calls.map((call) => new URL(call.url).pathname)).toEqual(['/complaints/42/mask']);
  calls = [];
  mockFetch(route({
    'POST /complaints/42/risk-analysis': () => json(200, { analysisId: 7, complaintId: 42, riskScore: 30, riskLevel: 'HIGH' }),
    'GET /risk-analyses/7/findings': () => json(200, findings),
  }));
  const result = await analyzeServerDraft(draft({ body: server().content, server: server() }), target, () => undefined, new AbortController().signal);
  expect(result.analysis).toMatchObject({ riskSummary: { riskScore: 30, riskLevel: 'HIGH' }, revisionReason: '[MOCK] 수정안', maskedContent: server().content, maskingContentVersion: 1 });
});

test('추가 문의는 서버 메시지 ID로 분석하며 최초 민원 mask API를 호출하지 않는다', async () => {
  const saved = { messageId: 101, complaintId: 42, content: '추가 문의', contentVersion: 1 };
  let stored = false;
  mockFetch(route({
    'GET /complaints/42/message-draft': () => stored ? json(200, saved) : json(404, { code: 'MESSAGE_DRAFT_NOT_FOUND' }),
    'PUT /complaints/42/message-draft': () => { stored = true; return json(200, saved); },
    'POST /complaints/42/messages/101/risk-analysis': () => json(200, { analysisId: 8, complaintId: 42, riskScore: 3, riskLevel: 'MEDIUM' }),
    'GET /risk-analyses/8/findings': () => json(200, findings),
  }));
  const result = await analyzeServerDraft(draft({ threadId: 'thread-local', body: '추가 문의' }), { ...target, complaintId: 42 }, () => undefined, new AbortController().signal);
  expect(result.server).toMatchObject({ complaintId: 42, serverMessageId: 101, analysisId: 8 });
  expect(calls.map((call) => new URL(call.url).pathname)).not.toContain('/complaints/42/mask');
  expect(calls[1].body).toEqual({ content: '추가 문의' });
});

test('추가 문의의 서버 초안이 다른 내용이면 덮어쓰지 않는다', async () => {
  mockFetch(route({
    'PUT /complaints/42/message-draft': () => json(409, { code: 'CONTENT_VERSION_CONFLICT', message: '추가 문의 초안이 다른 기기에서 변경되었습니다.' }),
    'GET /complaints/42/message-draft': () => json(200, { messageId: 101, complaintId: 42, content: '다른 탭에서 작성한 내용', contentVersion: 2 }),
  }));
  await expect(analyzeServerDraft(draft({ threadId: 'thread-local', body: '내가 작성한 내용', server: server({ serverMessageId: 101 }) }), target, () => undefined, new AbortController().signal)).rejects.toMatchObject({ status: 409, code: 'PARENT_DRAFT_CONFLICT' });
  expect(calls.find((call) => call.method === 'PUT')?.body).toEqual({ content: '내가 작성한 내용', expectedContentVersion: 1 });
  expect(calls.some((call) => call.url.includes('risk-analysis'))).toBe(false);
});

test('저장 응답을 놓친 뒤 재시도하면 서버 초안이 같은 내용일 때 그 초안으로 이어간다', async () => {
  mockFetch(route({
    'PUT /complaints/42/message-draft': () => json(409, { code: 'CONTENT_VERSION_CONFLICT' }),
    'GET /complaints/42/message-draft': () => json(200, { messageId: 101, complaintId: 42, content: '내가 작성한 내용', contentVersion: 2 }),
    'POST /complaints/42/messages/101/risk-analysis': () => json(200, { analysisId: 8, complaintId: 42, riskScore: 0, riskLevel: 'LOW' }),
    'GET /risk-analyses/8/findings': () => json(200, { findings: [], finalRevision: null }),
  }));
  const result = await analyzeServerDraft(draft({ threadId: 'thread-local', body: '내가 작성한 내용', server: server({ serverMessageId: 101 }) }), target, () => undefined, new AbortController().signal);
  expect(result.server).toMatchObject({ content: '내가 작성한 내용', contentVersion: 2 });
});

test('추가 문의 전송 응답을 놓치면 같은 서버 메시지의 전송 여부로 복구하고 중복 추가하지 않는다', async () => {
  const storage = installStorage();
  const sentAt = '2026-10-30T10:00:00';
  storage.set('teacher-hub.parent-sent-messages.101', JSON.stringify([{
    messageId: 'thread-local', serverComplaintId: 42, teacherId: '20', teacherName: 'Demo Teacher', title: server().title,
    originalBody: '최초 문의', finalBody: '최초 문의', status: 'SENT', selectionType: 'ORIGINAL', selectionSource: 'ORIGINAL', sentAt, auditLog: [],
  }]));
  mockFetch(route({
    'GET /complaints/42/message-draft': () => json(404, { code: 'MESSAGE_DRAFT_NOT_FOUND' }),
    'GET /complaints/42/messages': () => json(200, { complaintId: 42, messages: [{ messageId: 101, content: '추가 문의', status: 'SENT', sentAt }] }),
  }));
  const current = draft({ threadId: 'thread-local', title: server().title, body: '추가 문의', server: server({ serverMessageId: 101, content: '추가 문의' }) });
  const review = createMessageReview({ status: 'ready', revisedText: null, risks: [], meaningWarning: null });
  const sent = await submitServerDraft(101, current, review, new AbortController().signal);
  expect(sent.conversation).toEqual(expect.arrayContaining([expect.objectContaining({ id: current.messageId, body: '추가 문의' })]));
  calls = [];
  await submitServerDraft(101, current, review, new AbortController().signal);
  expect(calls).toHaveLength(0);
});

test('detector 결과의 새 상태·복수 근거·이전 boolean 응답을 구분하며 누락은 미확인이다', () => {
  expect(detectionState('BOUNDARY', false)).toBe('BOUNDARY');
  expect(detectionState(undefined, true)).toBe('PRESENT');
  expect(detectionState(undefined, false)).toBe('ABSENT');
  expect(detectionState(undefined)).toBe('UNKNOWN');
  expect(detectionEvidence({ state: 'PRESENT', confidence: 0, evidenceSpans: [{ text: '첫 근거' }, { text: '둘째 근거' }] })).toEqual(['첫 근거', '둘째 근거']);
  expect(detectionEvidence({ confidence: 0, evidenceSpans: [], evidences: ['이전 근거'] })).toEqual([]);
  expect(detectionConfidence(0)).toBe('0%');
  expect(detectionConfidence(0.91)).toBe('91%');
  expect(detectionConfidence(null)).toBe('제공되지 않음');
});

function seedFollowUpThread() {
  const storage = installStorage();
  storage.set('teacher-hub.parent-sent-messages.101', JSON.stringify([{
    messageId: 'thread-local', serverComplaintId: 42, teacherId: '20', teacherName: 'Demo Teacher', title: server().title,
    originalBody: '최초 문의', finalBody: '최초 문의', status: 'SENT', selectionType: 'ORIGINAL', selectionSource: 'ORIGINAL', sentAt: '2026-10-30T10:00:00Z', auditLog: [],
  }]));
  return storage;
}

test('서로 다른 로컬 초안이 같은 서버 메시지를 보내도 대화에는 한 번만 표시한다', async () => {
  const storage = seedFollowUpThread();
  let sent = false;
  mockFetch(route({
    'GET /complaints/42/message-draft': () => sent ? json(404, { code: 'MESSAGE_DRAFT_NOT_FOUND' }) : json(200, { messageId: 101, content: '추가 문의' }),
    'PUT /complaints/42/message-draft': () => json(200, { messageId: 101, content: '추가 문의', contentVersion: 1 }),
    'POST /complaints/42/messages/101/send': () => { sent = true; return json(200, { messageId: 101, content: '추가 문의', sentAt: '2026-10-30T10:03:00' }); },
    'GET /complaints/42/messages': () => json(200, { messages: [{ messageId: 101, content: '추가 문의', status: 'SENT', sentAt: '2026-10-30T10:03:00' }] }),
  }));
  const current = draft({ threadId: 'thread-local', title: server().title, body: '추가 문의', server: server({ serverMessageId: 101, content: '추가 문의' }) });
  const review = createMessageReview({ status: 'ready', revisedText: null, risks: [], meaningWarning: null });
  await submitServerDraft(101, current, review, new AbortController().signal);
  await submitServerDraft(101, { ...current, messageId: 'other-local-id' }, review, new AbortController().signal);
  const stored = JSON.parse(storage.get('teacher-hub.parent-sent-messages.101')!)[0];
  expect(stored.conversation.filter((entry: { body: string }) => entry.body === '추가 문의')).toHaveLength(1);
  expect(calls.filter((call) => call.url.endsWith('/send'))).toEqual([expect.objectContaining({ body: { expectedContentVersion: 1 } })]);
  // A different confirmed sentence must not be treated as that already-sent message.
  await expect(submitServerDraft(101, { ...current, messageId: 'unsent-edit' }, { ...review, originalEdit: '아직 전송하지 않은 수정문' }, new AbortController().signal)).rejects.toMatchObject({ code: 'PARENT_MESSAGE_CONTENT_MISMATCH' });
  await expect(submitServerDraft(101, current, { ...review, originalEdit: '같은 로컬 초안에서 수정한 문장' }, new AbortController().signal)).rejects.toMatchObject({ code: 'PARENT_MESSAGE_CONTENT_MISMATCH' });
  expect(JSON.parse(storage.get('teacher-hub.parent-sent-messages.101')!)[0].conversation).toHaveLength(2);
});

test('추가 문의 저장 성공 뒤 전송이 실패해도 저장 응답을 유지해 문장을 바꿔 재시도할 수 있다', async () => {
  seedFollowUpThread();
  let content = '원래 문의';
  let failSend = true;
  mockFetch((call) => {
    const path = new URL(call.url).pathname;
    if (path.endsWith('/message-draft')) {
      if (call.method === 'PUT') content = (call.body as { content: string }).content;
      return json(200, { messageId: 101, content, contentVersion: 2 });
    }
    if (path.endsWith('/send')) return failSend ? json(500, { code: 'INTERNAL_SERVER_ERROR' }) : json(200, { messageId: 101, content, sentAt: '2026-10-30T10:03:00' });
    if (path.endsWith('/messages')) return json(200, { messages: [] });
    throw new Error(`Unexpected request ${path}`);
  });
  let acknowledged = server({ serverMessageId: 101, content });
  const current = draft({ threadId: 'thread-local', title: server().title, body: content, server: acknowledged });
  const review = createMessageReview({ status: 'ready', revisedText: '첫 수정', risks: [], meaningWarning: null });
  await expect(submitServerDraft(101, current, review, new AbortController().signal, undefined,
    (next: ServerComplaintDraft) => { acknowledged = next; })).rejects.toMatchObject({ status: 500 });
  expect(acknowledged.content).toBe('첫 수정');
  failSend = false;
  const result = await submitServerDraft(101, { ...current, server: acknowledged }, { ...review, aiText: '다시 수정' }, new AbortController().signal);
  expect(result.conversation?.at(-1)?.body).toBe('다시 수정');
});

test('재분석이 제한돼도 이미 조회한 서버 마스킹 결과를 원문 선택에 유지한다', async () => {
  mockFetch(route({
    'POST /complaints/42/mask': () => json(200, { complaintId: 42, contentVersion: 3, maskedContent: '서버에서 추가로 가린 내용' }),
    'POST /complaints/42/risk-analysis': () => json(409, { code: 'FINAL_ANALYSIS_ON_SUBMIT' }),
  }));
  const current = draft({ body: server().content, server: server() });
  const result = await analyzeServerDraft(current, target, () => undefined, new AbortController().signal);
  expect(result.analysis).toMatchObject({ analyzeOnSubmit: true, maskedContent: '서버에서 추가로 가린 내용', maskingContentVersion: 3 });
  expect(getSelectedMessage(current.body, createMessageReview(result.analysis)).text).toBe('서버에서 추가로 가린 내용');
});

test('전송 응답의 본문이 확인한 문장과 다르면 로컬에 성공 사본을 만들지 않는다', async () => {
  const storage = seedFollowUpThread();
  mockFetch(route({
    'PUT /complaints/42/message-draft': () => json(200, { messageId: 101, content: '확인한 문장', contentVersion: 1 }),
    'POST /complaints/42/messages/101/send': () => json(200, { messageId: 101, content: '다른 탭의 문장', sentAt: '2026-10-30T10:03:00' }),
    'GET /complaints/42/messages': () => json(200, { messages: [{ messageId: 101, content: '다른 탭의 문장', status: 'SENT' }] }),
  }));
  const current = draft({ threadId: 'thread-local', title: server().title, body: '확인한 문장', server: server({ serverMessageId: 101, content: '확인한 문장' }) });
  const review = createMessageReview({ status: 'ready', revisedText: null, risks: [], meaningWarning: null });
  await expect(submitServerDraft(101, current, review, new AbortController().signal)).rejects.toMatchObject({ code: 'PARENT_MESSAGE_CONTENT_MISMATCH' });
  expect(JSON.parse(storage.get('teacher-hub.parent-sent-messages.101')!)[0].conversation).toBeUndefined();
});

test('최종 수정 이유가 null이어도 유효한 수정문과 위험 근거를 유지한다', () => {
  const analysis = toServerAnalysis({ ...findings, finalRevision: { content: '수정된 문장', reason: null } }, '원문');
  expect(analysis).toMatchObject({ status: 'ready', revisedText: '수정된 문장', revisionReason: null });
  expect(analysis.risks).not.toHaveLength(0);
});
