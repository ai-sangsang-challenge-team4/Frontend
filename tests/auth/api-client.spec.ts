import { expect, test } from '@playwright/test';
import { apiClient, configureApiClient } from '../../src/shared/api/apiClient';
import { ApiError, getApiErrorCopy, getApiErrorMessage } from '../../src/shared/api/apiError';

type FetchCall = { url: string; init: RequestInit };

const originalFetch = globalThis.fetch;
let calls: FetchCall[] = [];

function mockFetch(handler: (call: FetchCall) => Response | Promise<Response>) {
  globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const call = { url: String(input), init };
    calls.push(call);
    return handler(call);
  }) as typeof fetch;
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function catchError(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('요청이 실패하지 않았습니다.');
}

test.beforeEach(() => {
  calls = [];
  configureApiClient({ baseUrl: 'https://api.test/v1', timeoutMs: 1_000, getAccessToken: () => null, onUnauthorized: () => undefined });
});

test.afterAll(() => {
  globalThis.fetch = originalFetch;
});

test('baseURL·query·Authorization 헤더를 붙이고 응답 DTO를 그대로 돌려준다', async () => {
  configureApiClient({ getAccessToken: () => 'token-123' });
  mockFetch(() => json(200, { id: 7 }));

  const result = await apiClient.post<{ id: number }>('/messages', { body: '안녕하세요' }, { query: { page: 1, tag: ['a', 'b'], empty: undefined } });

  expect(result).toEqual({ id: 7 });
  expect(calls[0].url).toBe('https://api.test/v1/messages?page=1&tag=a&tag=b');
  const headers = new Headers(calls[0].init.headers);
  expect(headers.get('Authorization')).toBe('Bearer token-123');
  expect(headers.get('Content-Type')).toBe('application/json');
  expect(calls[0].init.body).toBe(JSON.stringify({ body: '안녕하세요' }));
});

test('auth: false 요청에는 Authorization 헤더를 붙이지 않는다', async () => {
  configureApiClient({ getAccessToken: () => 'token-123' });
  mockFetch(() => new Response(null, { status: 204 }));

  await expect(apiClient.post('/auth/login', {}, { auth: false })).resolves.toBeUndefined();
  expect(new Headers(calls[0].init.headers).has('Authorization')).toBe(false);
});

for (const [status, kind] of [
  [400, 'BAD_REQUEST'],
  [401, 'UNAUTHORIZED'],
  [403, 'FORBIDDEN'],
  [404, 'NOT_FOUND'],
  [409, 'CONFLICT'],
  [500, 'SERVER'],
] as const) {
  test(`${status} 응답을 ${kind} ApiError로 변환한다`, async () => {
    mockFetch(() => json(status, {
      status: 'ERROR', code: 'SOME_CODE', message: '서버 메시지',
      timestamp: '2026-08-07T19:50:00+09:00', path: '/api/complaints/1',
    }));

    const error = await catchError(apiClient.get('/complaints/1'));

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status, kind, code: 'SOME_CODE', serverMessage: '서버 메시지',
      timestamp: '2026-08-07T19:50:00+09:00', path: '/api/complaints/1',
    });
  });
}

test('토큰이 있는 요청이 401이면 onUnauthorized를 호출한다', async () => {
  const unauthorized: ApiError[] = [];
  configureApiClient({ getAccessToken: () => 'expired', onUnauthorized: (error) => unauthorized.push(error) });
  mockFetch(() => json(401, { status: 'ERROR', code: 'UNAUTHORIZED', message: '인증 실패' }));

  await catchError(apiClient.get('/me'));
  expect(unauthorized).toHaveLength(1);

  configureApiClient({ getAccessToken: () => null });
  await catchError(apiClient.get('/me'));
  expect(unauthorized).toHaveLength(1);
});

test('로그인 실패(401) 사유는 서버 문구를 보여주고 세션 만료 처리는 하지 않는다', async () => {
  const unauthorized: ApiError[] = [];
  configureApiClient({ getAccessToken: () => 'token', onUnauthorized: (error) => unauthorized.push(error) });
  mockFetch(() => json(401, { status: 'ERROR', code: 'UNAUTHORIZED', message: '이메일 또는 비밀번호가 올바르지 않습니다.' }));

  const error = await catchError(apiClient.post('/auth/login', {}, { auth: false }));
  expect(getApiErrorMessage(error)).toBe('이메일 또는 비밀번호가 올바르지 않습니다.');
  expect(unauthorized).toHaveLength(0);
});

test('핸들러가 없는 예외(Spring 기본 오류 본문)는 상태 코드 기본 문구로 처리한다', async () => {
  mockFetch(() => json(500, { timestamp: '2026-10-25T00:00:00.000+00:00', status: 500, error: 'Internal Server Error', path: '/auth/signup' }));
  const error = await catchError(apiClient.post('/auth/signup', {}, { auth: false }));
  expect(error).toMatchObject({ kind: 'SERVER', code: 'SERVER', serverMessage: null, path: '/auth/signup' });
  expect(getApiErrorMessage(error)).toBe('일시적인 문제가 발생했어요. 서비스 이용에 불편을 드려 죄송해요. 잠시 후 다시 시도해 주세요.');
});

test('400 검증 오류와 409 충돌 사유를 보여주고, 정의된 에러 코드는 서비스 문구로 바꾼다', async () => {
  mockFetch(() => json(400, { status: 'ERROR', code: 'VALIDATION_ERROR', message: '제목을 입력해 주세요.' }));
  const badRequest = await catchError(apiClient.post('/complaints', {}));
  expect(getApiErrorCopy(badRequest).description).toBe('제목을 입력해 주세요.');

  mockFetch(() => json(409, { status: 'ERROR', code: 'REANALYSIS_LIMIT_REACHED', message: '재분석은 1회만 가능합니다.' }));
  const conflict = await catchError(apiClient.post('/complaints/1/risk-analysis', {}));
  expect(getApiErrorMessage(conflict)).toBe('재분석은 한 번만 할 수 있어요. 재분석 후에는 내용을 수정할 수 없어요.');
  expect(getApiErrorCopy(conflict)).toMatchObject({ title: '요청을 완료할 수 없어요.', actionLabel: '새로고침' });

  mockFetch(() => json(404, { status: 'ERROR', code: 'COMPLAINT_NOT_FOUND', message: '민원을 찾을 수 없습니다.' }));
  expect(getApiErrorCopy(await catchError(apiClient.get('/complaints/9')))).toMatchObject({
    title: '페이지를 찾을 수 없어요.', description: '문의 내역을 찾을 수 없어요.', actionLabel: '홈으로',
  });
});

test('500 응답은 서버 내부 메시지 대신 공통 안내 문구를 보여준다', async () => {
  mockFetch(() => json(500, { status: 'ERROR', code: 'INTERNAL_SERVER_ERROR', message: 'NullPointerException at ...' }));
  const error = await catchError(apiClient.get('/messages'));
  expect(getApiErrorMessage(error)).not.toContain('NullPointerException');
  expect(getApiErrorCopy(error)).toMatchObject({
    title: '일시적인 문제가 발생했어요.',
    description: '서비스 이용에 불편을 드려 죄송해요. 잠시 후 다시 시도해 주세요.',
    actionLabel: '다시 시도하기',
  });
});

test('네트워크 오류와 응답 시간 초과를 구분한다', async () => {
  mockFetch(() => { throw new TypeError('Failed to fetch'); });
  expect(await catchError(apiClient.get('/messages'))).toMatchObject({ kind: 'NETWORK', status: 0 });

  mockFetch(({ init }) => new Promise((_, reject) => {
    init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  }));
  const timeout = await catchError(apiClient.get('/messages', { timeoutMs: 20 }));
  expect(timeout).toMatchObject({ kind: 'TIMEOUT' });
  expect(getApiErrorCopy(timeout).title).toBe('응답이 지연되고 있어요.');
});

test('호출자가 취소한 요청은 ApiError가 아닌 AbortError로 끝난다', async () => {
  mockFetch(({ init }) => new Promise((_, reject) => {
    init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  }));
  const controller = new AbortController();
  const pending = catchError(apiClient.get('/messages', { signal: controller.signal }));
  controller.abort();
  const error = await pending;
  expect(error).not.toBeInstanceOf(ApiError);
  expect(error).toMatchObject({ name: 'AbortError' });
});
