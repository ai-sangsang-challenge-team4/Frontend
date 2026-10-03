import { isUser } from '../authState';
import { AuthApiError, type AuthSession } from './authApiContract';

export const AUTH_SESSION_STORAGE_KEY = 'teacher-hub.auth-session';

export function readAuthSession(): AuthSession | null {
  const value = readStoredJson<Partial<AuthSession>>(AUTH_SESSION_STORAGE_KEY);

  if (
    !value ||
    typeof value.accessToken !== 'string' || !value.accessToken.trim() ||
    typeof value.refreshToken !== 'string' || !value.refreshToken.trim() ||
    typeof value.expiresAt !== 'number' || !Number.isFinite(value.expiresAt) ||
    !isUser(value.user)
  ) {
    clearAuthSession();
    return null;
  }

  return value as AuthSession;
}

export function persistAuthSession(session: AuthSession) {
  writeStoredJson(AUTH_SESSION_STORAGE_KEY, session);
}

export function clearAuthSession() {
  removeStoredValue(AUTH_SESSION_STORAGE_KEY);
}

export function readStoredJson<T>(key: string): T | null {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) as T : null;
  } catch {
    removeStoredValue(key);
    return null;
  }
}

export function writeStoredJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    throw new AuthApiError({
      code: 'STORAGE_UNAVAILABLE',
      message: '브라우저 저장소를 사용할 수 없습니다. 저장소 설정을 확인해 주세요.',
      status: 503,
    });
  }
}

export function removeStoredValue(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    return;
  }
}
