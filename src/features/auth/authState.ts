import type { User, UserRole } from '../../shared/types';
import type { ChildSignupInfo } from './childSignup';

export type LoginInput = {
  email: string;
  password: string;
};

export type SignupRole = Exclude<UserRole, 'ADMIN'>;

export type SignupInput = {
  email: string;
  password: string;
} & (
  | { role: 'PARENT'; child: ChildSignupInfo; name?: never }
  | { role: 'TEACHER'; name: string; child?: never }
);

export type AuthContextValue = {
  user: User | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  isLoading: boolean;
  sessionError: string | null;
  login: (input: LoginInput) => Promise<User>;
  signup: (input: SignupInput) => Promise<User>;
  logout: () => void;
  retrySession: () => Promise<void>;
};

export const ROLE_HOME_PATH: Record<UserRole, string> = {
  PARENT: '/parent/messages/new',
  TEACHER: '/teacher',
  ADMIN: '/admin',
};

export const ROLE_LABEL: Record<UserRole, string> = {
  PARENT: '학부모',
  TEACHER: '교사',
  ADMIN: '관리자',
};

export const SIGNUP_ROLE_OPTIONS: SignupRole[] = ['PARENT', 'TEACHER'];

export function getDefaultRolePath(role: UserRole) {
  return ROLE_HOME_PATH[role];
}

export function isUser(value: unknown): value is User {
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

export function isUserRole(value: unknown): value is UserRole {
  return value === 'PARENT' || value === 'TEACHER' || value === 'ADMIN';
}
