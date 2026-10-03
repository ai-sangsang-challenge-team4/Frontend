import type { User, UserRole } from '../../shared/types';

const rolePathMap: Record<UserRole, string> = {
  ADMIN: '/admin',
  PARENT: '/parent',
  TEACHER: '/teacher',
};

function getRoleFromPath(pathname: string): UserRole {
  if (pathname.startsWith('/admin')) {
    return 'ADMIN';
  }

  if (pathname.startsWith('/parent')) {
    return 'PARENT';
  }

  return 'TEACHER';
}

export function getDefaultRolePath(role: UserRole) {
  return rolePathMap[role];
}

export function useAuth(): { isAuthenticated: boolean; user: User } {
  const role =
    typeof window === 'undefined'
      ? 'TEACHER'
      : getRoleFromPath(window.location.pathname);

  return {
    isAuthenticated: true,
    user: {
      userId: 1,
      name: '조예인',
      email: 'teacher@example.com',
      role,
    },
  };
}

