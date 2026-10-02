import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import type { UserRole } from '../../shared/types';

type RoleRouteProps = {
  allowedRoles: UserRole[];
  children: ReactNode;
};

export function RoleRoute({ allowedRoles, children }: RoleRouteProps) {
  // TODO: 서버 권한 검증 연동 전까지 역할 라우트에 실제 데이터를 노출하지 않는다.
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length === 0 || !allowedRoles.includes(user.role)) {
    return <Navigate to={getDefaultRolePath(user.role)} replace />;
  }

  return <>{children}</>;
}
