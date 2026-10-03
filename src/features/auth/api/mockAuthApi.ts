import type { User } from '../../../shared/types';
import { isUser, type LoginInput, type SignupInput } from '../authState';
import {
  AuthApiError,
  isValidEmail,
  type AuthApi,
  type AuthSession,
  type ResetPasswordInput,
  type VerificationCodeResult,
} from './authApiContract';
import {
  clearAuthSession,
  readAuthSession,
  readStoredJson,
  removeStoredValue,
  writeStoredJson,
} from './authStorage';

type AuthAccount = User & { password: string };
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
const PASSWORD_RESET_STORAGE_KEY = 'teacher-hub.auth-password-reset-code';
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
    throw unauthorized('TOKEN_EXPIRED', '로그인 시간이 만료되었습니다. 다시 로그인해 주세요.');
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

  if (!input.name.trim()) {
    throw new AuthApiError({ code: 'NAME_REQUIRED', message: '이름을 입력해 주세요.' });
  }
  if (input.role !== 'PARENT' && input.role !== 'TEACHER') {
    throw new AuthApiError({ code: 'INVALID_ROLE', message: '학부모 또는 교사를 선택해 주세요.' });
  }

  const email = normalizeEmail(input.email);
  const accounts = readAccounts();
  assertUniqueEmail(email, accounts);
  const verification = readVerification(SIGNUP_VERIFICATION_STORAGE_KEY);
  if (!verification || verification.email !== email || !verification.verified) {
    throw new AuthApiError({ code: 'EMAIL_NOT_VERIFIED', message: '이메일 인증을 완료해 주세요.' });
  }

  const account: AuthAccount = {
    userId: Math.max(300, ...accounts.map((entry) => entry.userId)) + 1,
    email,
    name: input.name.trim(),
    password: input.password,
    role: input.role,
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

async function sendPasswordResetVerificationCode(emailInput: string) {
  await waitForRequest('sendPasswordResetVerificationCode');
  assertValidEmail(emailInput);
  const email = normalizeEmail(emailInput);
  if (!readAccounts().some((entry) => normalizeEmail(entry.email) === email)) {
    throw new AuthApiError({ code: 'EMAIL_NOT_FOUND', message: '가입된 이메일을 찾을 수 없습니다.', status: 404 });
  }
  return persistVerification(PASSWORD_RESET_STORAGE_KEY, email);
}

async function resetPassword(input: ResetPasswordInput) {
  await waitForRequest('resetPassword');
  assertValidPassword(input.newPassword);
  assertValidVerification(PASSWORD_RESET_STORAGE_KEY, input.email, input.code);
  const accounts = readAccounts();
  const account = accounts.find((entry) => normalizeEmail(entry.email) === normalizeEmail(input.email));
  if (!account) {
    throw new AuthApiError({ code: 'EMAIL_NOT_FOUND', message: '가입된 이메일을 찾을 수 없습니다.', status: 404 });
  }
  writeStoredJson(ACCOUNT_STORAGE_KEY,
    accounts.map((entry) => entry.userId === account.userId ? { ...entry, password: input.newPassword } : entry),
  );
  const issuedSessions = readIssuedSessions();
  const currentSession = readAuthSession();
  writeStoredJson(ISSUED_SESSION_STORAGE_KEY,
    issuedSessions.filter((entry) => entry.userId !== account.userId),
  );
  if (
    currentSession &&
    issuedSessions.some((entry) =>
      entry.userId === account.userId && entry.accessToken === currentSession.accessToken,
    )
  ) {
    clearAuthSession();
  }
  removeStoredValue(PASSWORD_RESET_STORAGE_KEY);
  return true;
}

export const mockAuthApi: AuthApi = {
  login,
  signup,
  getCurrentUser,
  logout,
  sendEmailVerificationCode,
  verifyEmailCode,
  sendPasswordResetVerificationCode,
  resetPassword,
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
