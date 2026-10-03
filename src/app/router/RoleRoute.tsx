import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { getDefaultRolePath, useAuth } from '../../features/auth';
import type { UserRole } from '../../shared/types';

type RoleRouteProps = {
  allowedRoles: UserRole[];
  children: ReactNode;
};

export function RoleRoute({ allowedRoles, children }: RoleRouteProps) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length === 0 || !allowedRoles.includes(user.role)) {
    return <Navigate to={getDefaultRolePath(user.role)} replace />;
  }

  return <>{children}</>;
}
