import { expect, test } from '@playwright/test';
import { configureApiClient } from '../../src/shared/api/apiClient';
import { getApiErrorMessage, toApiError } from '../../src/shared/api/apiError';
import { httpParentComplaintApi } from '../../src/features/parent-message/api/httpParentComplaintApi';
import type { RiskRevisionResponse } from '../../src/features/parent-message/api/parentComplaintTypes';
import type { MessageDraft, ServerComplaintDraft } from '../../src/features/parent-message/messageDraft';
import { createMessageReview } from '../../src/features/parent-message/parentMessageTypes';
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
    const respond = routes[key];
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
  await httpParentComplaintApi.listComplaints(1);
  await httpParentComplaintApi.listRecipients(10);
  await httpParentComplaintApi.createDraft({ studentId: 10, teacherId: 20, title: '제목', content: '내용' });
  await httpParentComplaintApi.updateDraft(42, { content: '수정' });
  await httpParentComplaintApi.analyze(42);
  await httpParentComplaintApi.getFindings(7);
  await httpParentComplaintApi.submit(42);
  await httpParentComplaintApi.getStatus(42);

  expect(calls.map(({ method, url, body }) => [method, url.replace('https://api.test', ''), body])).toEqual([
    ['GET', '/complaints?page=1', undefined],
    ['GET', '/complaints/recipients?studentId=10', undefined],
    ['POST', '/complaints', { studentId: 10, teacherId: 20, title: '제목', content: '내용' }],
    ['PATCH', '/complaints/42', { content: '수정' }],
    ['POST', '/complaints/42/risk-analysis', undefined],
    ['GET', '/risk-analyses/7/findings', undefined],
    ['POST', '/complaints/42/send', undefined],
    ['GET', '/complaints/42/status', undefined],
  ]);
});

test('자녀 목록은 학부모 민원 목록의 모든 페이지에서 중복 없이 모은다', async () => {
  const item = (studentId: number, studentName: string) => ({ studentId, studentName });
  mockFetch((call) => new URL(call.url).searchParams.get('page') === '0'
    ? json(200, { content: [item(10, '김하나'), item(11, '김두리'), item(10, '김하나')], hasNext: true })
    : json(200, { content: [item(11, '김두리'), item(12, '김세찌')], hasNext: false }));

  expect(await listServerChildren()).toEqual([
    { studentId: 10, studentName: '김하나' },
    { studentId: 11, studentName: '김두리' },
    { studentId: 12, studentName: '김세찌' },
  ]);
  expect(calls).toHaveLength(2);
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
  expect(calls.map((call) => call.method)).toEqual(['POST', 'POST', 'GET']);
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
    'PATCH /complaints/42', 'POST /complaints/42/risk-analysis',
  ]);
  expect(calls[0].body).toEqual({ content: '바꾼 본문' });
  expect(persisted).toEqual([server({ content: '바꾼 본문' })]);
  expect(result.analysis).toEqual({ status: 'ready', revisedText: null, risks: [], meaningWarning: null, analyzeOnSubmit: true });
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
