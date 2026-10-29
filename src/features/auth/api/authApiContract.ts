import type { User } from '../../../shared/types';
import type { LoginInput, SignupInput } from '../authState';

export type AuthSession = {
  accessToken: string;
  // The backend issues no refresh token; only the mock fills this in.
  refreshToken?: string;
  expiresAt: number;
  user: User;
};

// expiresAt is omitted when the server reports no expiry (GET /users/me); the stored value is kept.
export type CurrentUserResult = Pick<AuthSession, 'user'> & Partial<Pick<AuthSession, 'expiresAt'>>;
export type VerificationCodeResult = { code: string; expiresAt: number };

export type AuthApi = {
  login: (input: LoginInput) => Promise<AuthSession>;
  signup: (input: SignupInput) => Promise<User>;
  getCurrentUser: (accessToken: string) => Promise<CurrentUserResult>;
  logout: (accessToken: string) => Promise<void>;
  // The backend has no email verification API, so the HTTP adapter leaves these out
  // and the signup form skips the verification step.
  sendEmailVerificationCode?: (email: string) => Promise<VerificationCodeResult>;
  verifyEmailCode?: (email: string, code: string) => Promise<boolean>;
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
