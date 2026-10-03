import type { ReactNode } from 'react';
import { Button } from '../../../shared/components/ui';
import { useAuth } from '../useAuth';

export function AuthSessionBoundary({ children }: { children: ReactNode }) {
  const { isInitializing, sessionError, retrySession, logout } = useAuth();

  if (isInitializing) {
    return (
      <main className="auth-session-status" aria-busy="true">
        <p role="status">로그인 정보를 확인하고 있습니다.</p>
      </main>
    );
  }

  if (sessionError) {
    return (
      <main className="auth-session-status">
        <p role="alert">{sessionError}</p>
        <div className="action-row">
          <Button onClick={() => { void retrySession(); }}>다시 시도</Button>
          <Button onClick={logout} variant="outline">로그인하기</Button>
        </div>
      </main>
    );
  }

  return children;
}
