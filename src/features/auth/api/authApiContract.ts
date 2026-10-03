import type { User } from '../../../shared/types';
import type { LoginInput, SignupInput } from '../authState';

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: User;
};

export type CurrentUserResult = Pick<AuthSession, 'user' | 'expiresAt'>;
export type VerificationCodeResult = { code: string; expiresAt: number };
export type ResetPasswordInput = { code: string; email: string; newPassword: string };

export type AuthApi = {
  login: (input: LoginInput) => Promise<AuthSession>;
  signup: (input: SignupInput) => Promise<User>;
  getCurrentUser: (accessToken: string) => Promise<CurrentUserResult>;
  logout: (accessToken: string) => Promise<void>;
  sendEmailVerificationCode: (email: string) => Promise<VerificationCodeResult>;
  verifyEmailCode: (email: string, code: string) => Promise<boolean>;
  sendPasswordResetVerificationCode: (email: string) => Promise<VerificationCodeResult>;
  resetPassword: (input: ResetPasswordInput) => Promise<boolean>;
};

export class AuthApiError extends Error {
  code: string;
  status: number;

  constructor({ code, message, status = 400 }: {
    code: string;
    message: string;
    status?: number;
  }) {
    super(message);
    this.name = 'AuthApiError';
    this.code = code;
    this.status = status;
  }
}

export function getAuthErrorMessage(error: unknown, fallbackMessage: string) {
  return error instanceof AuthApiError ? error.message : fallbackMessage;
}

export function isUnauthorizedError(error: unknown) {
  return error instanceof AuthApiError && error.status === 401;
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
