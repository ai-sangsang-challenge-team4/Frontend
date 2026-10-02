import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import type { UserRole } from '../../shared/types';

type RoleRouteProps = {
  allowedRoles: UserRole[];
  children: ReactNode;
};

export function RoleRoute({ allowedRoles, children }: RoleRouteProps) {
  if (allowedRoles.length === 0) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
