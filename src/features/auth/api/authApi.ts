import type { AuthApi } from './authApiContract';
import { mockAuthApi } from './mockAuthApi';

// Replace this adapter when the backend API contract is available.
const api: AuthApi = mockAuthApi;

export const {
  login,
  signup,
  getCurrentUser,
  logout,
  sendEmailVerificationCode,
  verifyEmailCode,
} = api;

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
