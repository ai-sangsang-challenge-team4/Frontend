import { expect, test } from '@playwright/test';
import { configureApiClient } from '../../src/shared/api/apiClient';
import { getApiErrorMessage } from '../../src/shared/api/apiError';
import { AuthApiError } from '../../src/features/auth/api/authApiContract';
import { httpAuthApi } from '../../src/features/auth/api/httpAuthApi';
import { httpSignupOptionsApi } from '../../src/features/auth/api/httpSignupOptionsApi';
import { toSignupRequest } from '../../src/features/auth/authState';

// Checks request paths and bodies against the backend auth controllers with a stubbed fetch.
// This does not prove the real server accepts them.

type FetchCall = { url: string; init: RequestInit };

const originalFetch = globalThis.fetch;
let calls: FetchCall[] = [];
let unauthorizedCount = 0;

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

const user = { userId: 2, email: 'teacher@test.com', name: 'Demo Teacher', role: 'TEACHER' };

test.beforeEach(() => {
  calls = [];
  unauthorizedCount = 0;
  configureApiClient({
    baseUrl: 'https://api.test',
    timeoutMs: 1_000,
    getAccessToken: () => 'current-jwt',
    onUnauthorized: () => { unauthorizedCount += 1; },
  });
});

test.afterAll(() => {
  globalThis.fetch = originalFetch;
});

test('로그인은 토큰 없이 보내고 expiresIn(초)으로 만료 시각을 계산하며 refreshToken을 만들지 않는다', async () => {
  mockFetch(() => json(200, { accessToken: 'jwt', tokenType: 'Bearer', expiresIn: 3600, user }));
  const before = Date.now();

  const session = await httpAuthApi.login({ email: ' teacher@test.com ', password: 'Test1234!' });

  expect(calls[0].url).toBe('https://api.test/auth/login');
  expect(new Headers(calls[0].init.headers).get('Authorization')).toBeNull();
  expect(JSON.parse(String(calls[0].init.body))).toEqual({ email: 'teacher@test.com', password: 'Test1234!' });
  expect(session.user).toEqual(user);
  expect(session).not.toHaveProperty('refreshToken');
  expect(session.expiresAt).toBeGreaterThanOrEqual(before + 3_600_000);
  expect(session.expiresAt).toBeLessThanOrEqual(Date.now() + 3_600_000);
});

test('로그인 401은 서버 사유를 AuthApiError로 전달한다', async () => {
  mockFetch(() => json(401, { code: 'UNAUTHORIZED', message: '이메일 또는 비밀번호가 올바르지 않습니다.' }));

  const error = await httpAuthApi.login({ email: 'teacher@test.com', password: 'wrong' }).catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(AuthApiError);
  expect(error).toMatchObject({ code: 'UNAUTHORIZED', message: '이메일 또는 비밀번호가 올바르지 않습니다.', status: 401 });
  expect(unauthorizedCount).toBe(0);
});

test('사용자 조회는 전달받은 토큰으로 /users/me를 부르고 만료 시각은 돌려주지 않는다', async () => {
  mockFetch(() => json(200, user));

  await expect(httpAuthApi.getCurrentUser('stored-jwt')).resolves.toEqual({ user });
  expect(calls[0].url).toBe('https://api.test/users/me');
  expect(new Headers(calls[0].init.headers).get('Authorization')).toBe('Bearer stored-jwt');
});

test('사용자 조회 401은 AuthProvider가 처리하도록 401 AuthApiError로 바꾸고 apiClient 콜백은 부르지 않는다', async () => {
  mockFetch(() => json(401, { code: 'UNAUTHORIZED', message: '인증이 필요합니다.' }));

  await expect(httpAuthApi.getCurrentUser('expired')).rejects.toMatchObject({ status: 401 });
  expect(unauthorizedCount).toBe(0);
});

test('HTTP 어댑터에는 로그아웃 API와 이메일 인증 API가 없다', async () => {
  mockFetch(() => json(200, {}));

  await httpAuthApi.logout('jwt');
  expect(calls).toHaveLength(0);
  expect(httpAuthApi.sendEmailVerificationCode).toBeUndefined();
  expect(httpAuthApi.verifyEmailCode).toBeUndefined();
});

test('폼 상태를 역할별 SignupRequest로 변환한다', () => {
  expect(toSignupRequest({
    email: ' parent@example.com ',
    password: 'password123',
    name: ' 김보호 ',
    role: 'PARENT',
    child: { schoolId: 1, schoolName: '상상초등학교', grade: 3, schoolClassId: 7, studentId: 21, name: ' 김학생 ' },
  })).toEqual({
    email: 'parent@example.com',
    password: 'password123',
    name: '김보호',
    role: 'PARENT',
    schoolId: 1,
    schoolClassId: 7,
    studentId: 21,
    studentName: '김학생',
    employeeNo: null,
  });

  expect(toSignupRequest({
    email: 'teacher@example.com',
    password: 'password123',
    name: '가입용 교사',
    role: 'TEACHER',
    schoolId: 1,
    employeeNo: ' DEV-2026-002 ',
  })).toEqual({
    email: 'teacher@example.com',
    password: 'password123',
    name: '가입용 교사',
    role: 'TEACHER',
    schoolId: 1,
    employeeNo: 'DEV-2026-002',
    schoolClassId: null,
    studentId: null,
    studentName: null,
  });
});

test('회원가입은 토큰 없이 SignupRequest를 보내고 SIGNUP_* 서버 사유를 그대로 보여 준다', async () => {
  mockFetch(() => json(400, { code: 'SIGNUP_VALIDATION_FAILED', message: '학생 번호와 자녀 이름이 일치하지 않습니다.' }));

  const error = await httpAuthApi.signup({
    email: 'parent@example.com',
    password: 'password123',
    name: '김보호',
    role: 'PARENT',
    child: { schoolId: 1, schoolName: '상상초등학교', grade: 3, schoolClassId: 7, studentId: 21, name: '김학생' },
  }).catch((caught: unknown) => caught);

  expect(calls[0].url).toBe('https://api.test/auth/signup');
  expect(new Headers(calls[0].init.headers).get('Authorization')).toBeNull();
  expect(JSON.parse(String(calls[0].init.body))).toMatchObject({ role: 'PARENT', schoolClassId: 7, studentId: 21 });
  expect(error).toMatchObject({ code: 'SIGNUP_VALIDATION_FAILED', message: '학생 번호와 자녀 이름이 일치하지 않습니다.' });
});

test('404 SIGNUP_REFERENCE_NOT_FOUND도 서버 사유를 보여 준다', async () => {
  mockFetch(() => json(404, { code: 'SIGNUP_REFERENCE_NOT_FOUND', message: '학교를 찾을 수 없습니다.' }));

  const error = await httpSignupOptionsApi.listSchoolClasses(99).catch((caught: unknown) => caught);
  expect(error).toMatchObject({ kind: 'NOT_FOUND', status: 404 });
  expect(getApiErrorMessage(error)).toBe('학교를 찾을 수 없습니다.');
});

test('회원가입 선택 항목은 공개 API를 학년 쿼리와 함께 부른다', async () => {
  mockFetch(() => json(200, []));

  await httpSignupOptionsApi.searchSchools(' 상상 ');
  await httpSignupOptionsApi.searchSchools('');
  await httpSignupOptionsApi.listSchoolClasses(1, { grade: 3 });
  await httpSignupOptionsApi.listClassStudents(7);

  expect(calls.map((call) => decodeURIComponent(call.url.replace('https://api.test', '')))).toEqual([
    '/auth/schools?keyword=상상',
    '/auth/schools',
    '/auth/schools/1/classes?grade=3',
    '/auth/classes/7/students',
  ]);
  expect(calls.every((call) => new Headers(call.init.headers).get('Authorization') === null)).toBe(true);
});
