import type { AuthApi } from './authApiContract';
import { httpAuthApi } from './httpAuthApi';
import { mockAuthApi } from './mockAuthApi';

// VITE_AUTH_API=http calls the backend (login, signup, signup options). Anything else uses the mock.
export const authApiMode: 'mock' | 'http' =
  import.meta.env?.VITE_AUTH_API === 'http' ? 'http' : 'mock';

const api: AuthApi = authApiMode === 'http' ? httpAuthApi : mockAuthApi;

export const {
  login,
  signup,
  getCurrentUser,
  logout,
  sendEmailVerificationCode,
  verifyEmailCode,
  getCurrentPolicyConsent,
  agreeToCurrentPolicy,
} = api;

export const isEmailVerificationSupported = Boolean(sendEmailVerificationCode && verifyEmailCode);

export {
  AuthApiError,
  getAuthErrorMessage,
  isUnauthorizedError,
  isValidEmail,
} from './authApiContract';
export type {
  AuthApi,
  AuthSession,
  CurrentUserResult,
  VerificationCodeResult,
} from './authApiContract';
export {
  AUTH_SESSION_STORAGE_KEY,
  clearAuthSession,
  persistAuthSession,
  readAuthSession,
} from './authStorage';
export { httpAuthApi } from './httpAuthApi';
export * from './signupOptionsApi';
export type { SignupOptionResponse } from './authTypes';
