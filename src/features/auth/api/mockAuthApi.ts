import type { User } from '../../../shared/types';
import { isUser, toSignupRequest, type LoginInput, type SignupInput } from '../authState';
import { validateChildSignupInfo } from '../childSignup';
import { validateTeacherSignupInfo, type TeacherSignupInfo } from '../teacherSignup';
import {
  AuthApiError,
  isValidEmail,
  type AuthApi,
  type AuthSession,
  type VerificationCodeResult,
} from './authApiContract';
import {
  readStoredJson,
  removeStoredValue,
  writeStoredJson,
} from './authStorage';
import type { SignupRequest } from './authTypes';
import { hasMockSchool, hasMockStudentPlacement } from './mockSignupOptionsApi';

// What the server links on signup: the parent's student, or the teacher's roster entry.
type MockChildLink = Pick<SignupRequest, 'schoolId' | 'schoolClassId' | 'studentId' | 'studentName'>;
type AuthAccount = User & { password: string; child?: MockChildLink } & Partial<TeacherSignupInfo>;
type IssuedSession = Omit<AuthSession, 'user'> & { userId: number };
type StoredVerification = VerificationCodeResult & { email: string; verified: boolean };
type MockSettings = {
  delayMs?: number;
  sessionDurationMs?: number;
  failures?: Partial<Record<keyof AuthApi, 401 | 503>>;
};

const ACCOUNT_STORAGE_KEY = 'teacher-hub.auth-accounts';
const ISSUED_SESSION_STORAGE_KEY = 'teacher-hub.auth-mock-sessions';
const SIGNUP_VERIFICATION_STORAGE_KEY = 'teacher-hub.auth-signup-code';
const SETTINGS_STORAGE_KEY = 'teacher-hub.auth-mock-settings';
const MOCK_VERIFICATION_CODE = '123456';
const DEFAULT_SESSION_DURATION_MS = 30 * 60 * 1000;

const DEFAULT_ACCOUNTS: AuthAccount[] = [
  { userId: 101, name: '학부모 사용자', email: 'parent@example.com', password: 'password123', role: 'PARENT' },
  { userId: 201, name: '교사 사용자', email: 'teacher@example.com', password: 'password123', role: 'TEACHER' },
  { userId: 301, name: '관리자 사용자', email: 'admin@teacherhub.local', password: 'admin1234', role: 'ADMIN' },
];

async function login(input: LoginInput): Promise<AuthSession> {
  await waitForRequest('login');
  const account = readAccounts().find((candidate) =>
    normalizeEmail(candidate.email) === normalizeEmail(input.email) &&
    candidate.password === input.password,
  );

  if (!account) {
    throw new AuthApiError({
      code: 'INVALID_CREDENTIALS',
      message: '이메일 또는 비밀번호가 올바르지 않습니다.',
      status: 401,
    });
  }

  const session: AuthSession = {
    accessToken: `mock-access.${crypto.randomUUID()}`,
    refreshToken: `mock-refresh.${crypto.randomUUID()}`,
    expiresAt: Date.now() + getSessionDuration(),
    user: toUser(account),
  };
  const { user, ...tokens } = session;
  writeStoredJson(ISSUED_SESSION_STORAGE_KEY, [
    ...readIssuedSessions().filter((entry) => entry.expiresAt > Date.now()),
    { ...tokens, userId: user.userId },
  ]);
  return session;
}

async function getCurrentUser(accessToken: string) {
  await waitForRequest('getCurrentUser');
  const session = readIssuedSessions().find((entry) => entry.accessToken === accessToken);

  if (!session) {
    throw unauthorized('INVALID_TOKEN', '인증 정보가 유효하지 않습니다. 다시 로그인해 주세요.');
  }
  if (session.expiresAt <= Date.now()) {
    throw unauthorized('TOKEN_EXPIRED', '세션이 만료되었습니다. 다시 로그인해 주세요.');
  }

  const account = readAccounts().find((entry) => entry.userId === session.userId);
  if (!account) {
    throw unauthorized('USER_NOT_FOUND', '사용자 정보를 찾을 수 없습니다. 다시 로그인해 주세요.');
  }
  return { user: toUser(account), expiresAt: session.expiresAt };
}

async function logout(accessToken: string) {
  await waitForRequest('logout');
  writeStoredJson(ISSUED_SESSION_STORAGE_KEY,
    readIssuedSessions().filter((entry) => entry.accessToken !== accessToken),
  );
}

async function signup(input: SignupInput): Promise<User> {
  await waitForRequest('signup');
  assertValidEmail(input.email);
  assertValidPassword(input.password);

  if (input.role !== 'PARENT' && input.role !== 'TEACHER') {
    throw new AuthApiError({ code: 'INVALID_ROLE', message: '학부모 또는 교사를 선택해 주세요.' });
  }
  // Same order and wording as the backend SignupRequest validation and AuthService.
  if (!input.name?.trim()) {
    throw new AuthApiError({ code: 'VALIDATION_FAILED', message: '이름은 필수입니다.' });
  }
  // Mirrors the backend SignupRequest requiredAgreed check.
  if (!input.policyAgreed) {
    throw new AuthApiError({ code: 'VALIDATION_FAILED', message: '필수 정책에 동의해야 회원가입할 수 있습니다.' });
  }

  if (input.role === 'PARENT') {
    const errors = validateChildSignupInfo(input.child);
    const message = Object.values(errors)[0];
    if (message) throw new AuthApiError({ code: 'SIGNUP_VALIDATION_FAILED', message });
  } else {
    const errors = validateTeacherSignupInfo(input);
    const message = Object.values(errors)[0];
    if (message) throw new AuthApiError({ code: 'SIGNUP_VALIDATION_FAILED', message });
    if (!hasMockSchool(input.schoolId)) {
      throw new AuthApiError({ code: 'SIGNUP_REFERENCE_NOT_FOUND', message: '학교를 찾을 수 없습니다.', status: 404 });
    }
  }

  const request = toSignupRequest(input);
  if (request.role === 'PARENT' &&
    !hasMockStudentPlacement(request.schoolId, request.schoolClassId ?? 0, request.studentId ?? 0)) {
    throw new AuthApiError({
      code: 'SIGNUP_REFERENCE_NOT_FOUND',
      message: '선택한 학교와 학급에서 학생 정보를 찾을 수 없습니다.',
      status: 404,
    });
  }

  const email = normalizeEmail(input.email);
  const accounts = readAccounts();
  assertUniqueEmail(email, accounts);
  const verification = readVerification(SIGNUP_VERIFICATION_STORAGE_KEY);
  if (!verification || verification.email !== email || !verification.verified) {
    throw new AuthApiError({ code: 'EMAIL_NOT_VERIFIED', message: '이메일 인증을 완료해 주세요.' });
  }

  const { schoolId, schoolClassId, studentId, studentName, employeeNo } = request;
  const account: AuthAccount = {
    userId: Math.max(300, ...accounts.map((entry) => entry.userId)) + 1,
    email,
    name: request.name,
    password: input.password,
    role: request.role,
    ...(request.role === 'PARENT'
      ? { child: { schoolId, schoolClassId, studentId, studentName } }
      : { schoolId, employeeNo: employeeNo ?? '' }),
  };
  writeStoredJson(ACCOUNT_STORAGE_KEY, [...accounts, account]);
  removeStoredValue(SIGNUP_VERIFICATION_STORAGE_KEY);
  return toUser(account);
}

async function sendEmailVerificationCode(emailInput: string) {
  await waitForRequest('sendEmailVerificationCode');
  assertValidEmail(emailInput);
  const email = normalizeEmail(emailInput);
  assertUniqueEmail(email, readAccounts());
  return persistVerification(SIGNUP_VERIFICATION_STORAGE_KEY, email);
}

async function verifyEmailCode(email: string, code: string) {
  await waitForRequest('verifyEmailCode');
  const verification = assertValidVerification(SIGNUP_VERIFICATION_STORAGE_KEY, email, code);
  writeStoredJson(SIGNUP_VERIFICATION_STORAGE_KEY, { ...verification, verified: true });
  return true;
}

export const mockAuthApi: AuthApi = {
  login,
  signup,
  getCurrentUser,
  logout,
  sendEmailVerificationCode,
  verifyEmailCode,
};

function readAccounts(): AuthAccount[] {
  const stored = readStoredJson<unknown>(ACCOUNT_STORAGE_KEY);
  const accounts = Array.isArray(stored)
    ? stored.filter((entry): entry is AuthAccount => isUser(entry) && 'password' in entry && typeof entry.password === 'string')
    : [];
  for (const account of DEFAULT_ACCOUNTS) {
    if (!accounts.some((entry) => normalizeEmail(entry.email) === normalizeEmail(account.email))) {
      accounts.push(account);
    }
  }
  return accounts;
}

function readIssuedSessions(): IssuedSession[] {
  const stored = readStoredJson<unknown>(ISSUED_SESSION_STORAGE_KEY);
  if (!Array.isArray(stored)) return [];
  return stored.filter((entry): entry is IssuedSession =>
    entry && typeof entry === 'object' &&
    typeof entry.accessToken === 'string' && typeof entry.refreshToken === 'string' &&
    typeof entry.userId === 'number' &&
    typeof entry.expiresAt === 'number' && Number.isFinite(entry.expiresAt),
  );
}

function readVerification(key: string): StoredVerification | null {
  const value = readStoredJson<Partial<StoredVerification>>(key);
  return value && typeof value.email === 'string' && typeof value.code === 'string' &&
    typeof value.expiresAt === 'number' && Number.isFinite(value.expiresAt) &&
    typeof value.verified === 'boolean'
    ? value as StoredVerification : null;
}

function persistVerification(key: string, email: string): VerificationCodeResult {
  const verification: StoredVerification = {
    code: MOCK_VERIFICATION_CODE,
    email,
    expiresAt: Date.now() + 180_000,
    verified: false,
  };
  writeStoredJson(key, verification);
  return { code: verification.code, expiresAt: verification.expiresAt };
}

function assertValidVerification(key: string, email: string, code: string) {
  const verification = readVerification(key);
  if (!verification || verification.email !== normalizeEmail(email)) {
    throw new AuthApiError({ code: 'VERIFICATION_NOT_REQUESTED', message: '인증코드를 먼저 요청해 주세요.' });
  }
  if (Date.now() >= verification.expiresAt) {
    throw new AuthApiError({ code: 'VERIFICATION_EXPIRED', message: '인증 시간이 만료되었습니다. 다시 요청해 주세요.' });
  }
  if (verification.code !== code.trim()) {
    throw unauthorized('INVALID_VERIFICATION_CODE', '인증코드가 올바르지 않습니다.');
  }
  return verification;
}

function assertUniqueEmail(email: string, accounts: AuthAccount[]) {
  if (accounts.some((entry) => normalizeEmail(entry.email) === email)) {
    throw new AuthApiError({ code: 'DUPLICATE_EMAIL', message: '이미 가입되어 있는 이메일입니다.', status: 409 });
  }
}

function assertValidEmail(email: string) {
  if (!isValidEmail(email)) {
    throw new AuthApiError({ code: 'INVALID_EMAIL', message: '이메일 형식으로 입력해 주세요.' });
  }
}

function assertValidPassword(password: string) {
  if (password.length < 8 || password.length > 20) {
    throw new AuthApiError({ code: 'INVALID_PASSWORD', message: '비밀번호는 8자 이상 20자 이하로 입력해 주세요.' });
  }
}

function toUser(account: AuthAccount): User {
  const { userId, email, name, role } = account;
  return { userId, email, name, role };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function unauthorized(code: string, message: string) {
  return new AuthApiError({ code, message, status: 401 });
}

function readSettings(): MockSettings {
  if (!import.meta.env.DEV) return {};
  const settings = readStoredJson<MockSettings>(SETTINGS_STORAGE_KEY);
  return settings && typeof settings === 'object' ? settings : {};
}

function positiveNumber(value: unknown, fallback: number) {
  const number = typeof value === 'string' ? Number(value) : value;
  return typeof number === 'number' && Number.isFinite(number) && number > 0 ? number : fallback;
}

function getSessionDuration() {
  return positiveNumber(readSettings().sessionDurationMs,
    positiveNumber(import.meta.env.VITE_MOCK_AUTH_SESSION_TTL_MS, DEFAULT_SESSION_DURATION_MS),
  );
}

async function waitForRequest(operation: keyof AuthApi) {
  const settings = readSettings();
  const configuredDelay = settings.delayMs ?? Number(import.meta.env.VITE_MOCK_AUTH_DELAY_MS ?? 250);
  const delay = Number.isFinite(configuredDelay) ? Math.max(0, Math.min(configuredDelay, 10_000)) : 250;
  await new Promise((resolve) => window.setTimeout(resolve, delay));

  const status = settings.failures?.[operation];
  if (status === 401) {
    throw unauthorized('UNAUTHORIZED', '인증 정보가 유효하지 않습니다. 다시 로그인해 주세요.');
  }
  if (status === 503) {
    throw new AuthApiError({
      code: 'SERVICE_UNAVAILABLE',
      message: '인증 서비스를 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.',
      status,
    });
  }
}
