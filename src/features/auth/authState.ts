import type { User, UserRole } from '../../shared/types';
import type { SignupRequest } from './api/authTypes';
import type { ChildSignupInfo } from './childSignup';
import type { TeacherSignupInfo } from './teacherSignup';

export type LoginInput = {
  email: string;
  password: string;
};

export type SignupRole = Exclude<UserRole, 'ADMIN'>;

// Signup form state. toSignupRequest maps it onto the backend SignupRequest.
export type SignupInput = {
  email: string;
  password: string;
  // The account holder's own name, required for every role.
  name: string;
} & (
  | { role: 'PARENT'; child: ChildSignupInfo; schoolId?: never; employeeNo?: never }
  | ({ role: 'TEACHER'; child?: never } & TeacherSignupInfo)
);

export function toSignupRequest(input: SignupInput): SignupRequest {
  const base = { email: input.email.trim(), password: input.password, name: input.name.trim() };
  if (input.role === 'PARENT') {
    return {
      ...base,
      role: 'PARENT',
      schoolId: input.child.schoolId,
      schoolClassId: input.child.schoolClassId,
      studentId: input.child.studentId,
      studentName: input.child.name.trim(),
      employeeNo: null,
    };
  }
  return {
    ...base,
    role: 'TEACHER',
    schoolId: input.schoolId,
    employeeNo: input.employeeNo.trim(),
    schoolClassId: null,
    studentId: null,
    studentName: null,
  };
}

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
