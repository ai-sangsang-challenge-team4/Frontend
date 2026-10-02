import type { User, UserRole } from '../../shared/types';

export type LoginInput = {
  role: UserRole;
  email?: string;
};

export type AuthContextValue = {
  user: User | null;
  isAuthenticated: boolean;
  login: (input: LoginInput) => User;
  logout: () => void;
};

export const ROLE_HOME_PATH: Record<UserRole, string> = {
  PARENT: '/parent',
  TEACHER: '/teacher',
  ADMIN: '/admin',
};

export const ROLE_LABEL: Record<UserRole, string> = {
  PARENT: '학부모',
  TEACHER: '교사',
  ADMIN: '관리자',
};

const AUTH_STORAGE_KEY = 'teacher-hub.auth-user';

const DEFAULT_USERS: Record<UserRole, User> = {
  PARENT: {
    userId: 101,
    name: '학부모 사용자',
    email: 'parent@example.com',
    role: 'PARENT',
  },
  TEACHER: {
    userId: 201,
    name: '교사 사용자',
    email: 'teacher@example.com',
    role: 'TEACHER',
  },
  ADMIN: {
    userId: 301,
    name: '관리자 사용자',
    email: 'admin@example.com',
    role: 'ADMIN',
  },
};

export function getDefaultRolePath(role: UserRole) {
  return ROLE_HOME_PATH[role];
}

export function createAuthUser({ role, email }: LoginInput): User {
  const defaultUser = DEFAULT_USERS[role];

  return {
    ...defaultUser,
    email: email?.trim() || defaultUser.email,
  };
}

export function readStoredUser(): User | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const storedUser = window.localStorage.getItem(AUTH_STORAGE_KEY);

  if (!storedUser) {
    return null;
  }

  try {
    const parsedUser: unknown = JSON.parse(storedUser);
    return isUser(parsedUser) ? parsedUser : null;
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export function persistUser(user: User | null) {
  if (typeof window === 'undefined') {
    return;
  }

  if (user) {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    return;
  }

  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

function isUser(value: unknown): value is User {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<User>;

  return (
    typeof candidate.userId === 'number' &&
    typeof candidate.name === 'string' &&
    typeof candidate.email === 'string' &&
    isUserRole(candidate.role)
  );
}

function isUserRole(value: unknown): value is UserRole {
  return value === 'PARENT' || value === 'TEACHER' || value === 'ADMIN';
}
