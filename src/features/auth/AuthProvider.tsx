import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AUTH_SESSION_STORAGE_KEY,
  AuthApiError,
  clearAuthSession,
  getAuthErrorMessage,
  getCurrentUser,
  isUnauthorizedError,
  login as loginRequest,
  logout as logoutRequest,
  persistAuthSession,
  readAuthSession,
  signup as signupRequest,
  type AuthSession,
} from './api/authApi';
import { AuthContext } from './AuthContext';
import type { LoginInput, SignupInput } from './authState';

type AuthProviderProps = { children: ReactNode };

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const sessionRef = useRef<AuthSession | null>(null);
  const requestRevision = useRef(0);
  const isRequestPending = useRef(false);

  const invalidateSession = useCallback((notice: string | null = null) => {
    requestRevision.current += 1;
    sessionRef.current = null;
    setSession(null);
    setIsInitializing(false);
    setIsLoading(false);
    setSessionError(null);
    setAuthNotice(notice);
    clearAuthSession();
  }, []);

  const restoreSession = useCallback(async (blocking = true) => {
    const storedSession = readAuthSession();
    if (!storedSession) {
      if (blocking || sessionRef.current) invalidateSession();
      return;
    }

    // Ignore responses from a session superseded by logout or another tab.
    const revision = ++requestRevision.current;
    if (blocking) {
      sessionRef.current = null;
      setSession(null);
      setIsInitializing(true);
    }
    setSessionError(null);

    try {
      const currentUser = await getCurrentUser(storedSession.accessToken);
      if (
        revision !== requestRevision.current ||
        readAuthSession()?.accessToken !== storedSession.accessToken
      ) return;

      const nextSession = { ...storedSession, ...currentUser };
      persistAuthSession(nextSession);
      sessionRef.current = nextSession;
      setSession(nextSession);
      setAuthNotice(null);
    } catch (error) {
      if (revision !== requestRevision.current) return;
      if (isUnauthorizedError(error)) {
        invalidateSession(getAuthErrorMessage(error, '다시 로그인해 주세요.'));
      } else if (blocking) {
        setSessionError(getAuthErrorMessage(error, '로그인 정보를 확인하지 못했습니다. 다시 시도해 주세요.'));
      }
    } finally {
      if (revision === requestRevision.current) setIsInitializing(false);
    }
  }, [invalidateSession]);

  useEffect(() => {
    void restoreSession();

    const handleStorage = (event: StorageEvent) => {
      if (event.key === AUTH_SESSION_STORAGE_KEY || event.key === null) {
        void restoreSession();
      }
    };
    const handleFocus = () => { void restoreSession(false); };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') handleFocus();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      requestRevision.current += 1;
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [restoreSession]);

  useEffect(() => {
    if (!session) return;
    let timer: number | undefined;
    const checkExpiration = () => {
      const remaining = session.expiresAt - Date.now();
      if (remaining <= 0) {
        invalidateSession('로그인 시간이 만료되었습니다. 다시 로그인해 주세요.');
      } else {
        timer = window.setTimeout(checkExpiration, Math.min(remaining, 2_147_483_647));
      }
    };
    checkExpiration();
    return () => window.clearTimeout(timer);
  }, [session, invalidateSession]);

  const login = useCallback(async (input: LoginInput) => {
    if (isRequestPending.current) {
      throw new AuthApiError({ code: 'REQUEST_IN_PROGRESS', message: '요청을 처리하는 중입니다. 잠시 기다려 주세요.' });
    }
    isRequestPending.current = true;
    const revision = ++requestRevision.current;
    setIsLoading(true);

    try {
      const nextSession = await loginRequest(input);
      if (revision !== requestRevision.current) {
        void logoutRequest(nextSession.accessToken).catch(() => undefined);
        throw new AuthApiError({ code: 'REQUEST_CANCELLED', message: '로그인 요청이 취소되었습니다. 다시 시도해 주세요.' });
      }
      persistAuthSession(nextSession);
      sessionRef.current = nextSession;
      setSession(nextSession);
      setSessionError(null);
      setAuthNotice(null);
      return nextSession.user;
    } finally {
      isRequestPending.current = false;
      if (revision === requestRevision.current) setIsLoading(false);
    }
  }, []);

  const signup = useCallback(async (input: SignupInput) => {
    if (isRequestPending.current) {
      throw new AuthApiError({ code: 'REQUEST_IN_PROGRESS', message: '요청을 처리하는 중입니다. 잠시 기다려 주세요.' });
    }
    isRequestPending.current = true;
    setIsLoading(true);
    try {
      return await signupRequest(input);
    } finally {
      isRequestPending.current = false;
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    const currentSession = sessionRef.current ?? readAuthSession();
    invalidateSession();
    if (currentSession) {
      void logoutRequest(currentSession.accessToken).catch(() => undefined);
    }
  }, [invalidateSession]);

  const retrySession = useCallback(() => restoreSession(), [restoreSession]);
  const user = session?.user ?? null;
  const value = useMemo(() => ({
    user,
    isAuthenticated: Boolean(user),
    isInitializing,
    isLoading,
    sessionError,
    authNotice,
    login,
    signup,
    logout,
    retrySession,
  }), [user, isInitializing, isLoading, sessionError, authNotice, login, signup, logout, retrySession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
