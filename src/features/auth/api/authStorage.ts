import { isUser } from '../authState';
import { AuthApiError, type AuthSession } from './authApiContract';

export const AUTH_SESSION_STORAGE_KEY = 'teacher-hub.auth-session';
export const MOCK_ISSUED_SESSION_STORAGE_KEY = 'teacher-hub.auth-mock-sessions';

type StorageName = 'localStorage' | 'sessionStorage';

export function clearLegacyAuthSessions() {
  removeStoredValue(AUTH_SESSION_STORAGE_KEY);
  removeStoredValue(MOCK_ISSUED_SESSION_STORAGE_KEY);
}

export function readAuthSession(): AuthSession | null {
  const value = readStoredJson<Partial<AuthSession>>(AUTH_SESSION_STORAGE_KEY, 'sessionStorage');

  if (
    !value ||
    typeof value.accessToken !== 'string' || !value.accessToken.trim() ||
    (value.refreshToken !== undefined && (typeof value.refreshToken !== 'string' || !value.refreshToken.trim())) ||
    typeof value.expiresAt !== 'number' || !Number.isFinite(value.expiresAt) ||
    !isUser(value.user)
  ) {
    clearAuthSession();
    return null;
  }

  return value as AuthSession;
}

export function persistAuthSession(session: AuthSession) {
  writeStoredJson(AUTH_SESSION_STORAGE_KEY, session, 'sessionStorage');
}

export function clearAuthSession() {
  removeStoredValue(AUTH_SESSION_STORAGE_KEY, 'sessionStorage');
}

export function readStoredJson<T>(key: string, storage: StorageName = 'localStorage'): T | null {
  try {
    const value = window[storage].getItem(key);
    return value ? JSON.parse(value) as T : null;
  } catch {
    removeStoredValue(key, storage);
    return null;
  }
}

export function writeStoredJson(key: string, value: unknown, storage: StorageName = 'localStorage') {
  try {
    window[storage].setItem(key, JSON.stringify(value));
  } catch {
    throw new AuthApiError({
      code: 'STORAGE_UNAVAILABLE',
      message: '브라우저 저장소를 사용할 수 없습니다. 저장소 설정을 확인해 주세요.',
      status: 503,
    });
  }
}

export function removeStoredValue(key: string, storage: StorageName = 'localStorage') {
  try {
    window[storage].removeItem(key);
  } catch {
    return;
  }
}
