import { apiClient, getApiErrorMessage, isApiError } from '../../../shared/api';
import type { User } from '../../../shared/types';
import { isUser, toSignupRequest } from '../authState';
import { AuthApiError, type AuthApi } from './authApiContract';
import type { LoginResponse, SignupResponse, UserInfoResponse } from './authTypes';

// AuthProvider and the forms read AuthApiError, so ApiError is converted here.
// The message keeps the server's reason (e.g. 401 "이메일 또는 비밀번호가 올바르지 않습니다.").
async function toAuthError<T>(request: Promise<T>, fallbackMessage: string, unauthorizedMessage?: string) {
  try {
    return await request;
  } catch (error) {
    if (!isApiError(error)) throw error;
    throw new AuthApiError({
      code: error.code,
      message: error.status === 401 && unauthorizedMessage
        ? unauthorizedMessage
        : getApiErrorMessage(error, fallbackMessage),
      status: error.status,
    });
  }
}

function toUser(response: UserInfoResponse): User {
  const user = { userId: response.userId, email: response.email, name: response.name, role: response.role };
  if (!isUser(user)) {
    throw new AuthApiError({ code: 'INVALID_USER', message: '사용자 정보를 확인하지 못했습니다.', status: 502 });
  }
  return user;
}

export const httpAuthApi: AuthApi = {
  login: async (input) => {
    const response = await toAuthError(
      apiClient.post<LoginResponse>('/auth/login', { email: input.email.trim(), password: input.password }, { auth: false }),
      '로그인하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    );
    return {
      accessToken: response.accessToken,
      expiresAt: Date.now() + response.expiresIn * 1000,
      user: toUser(response.user),
    };
  },

  signup: async (input) => {
    const response = await toAuthError(
      apiClient.post<SignupResponse>('/auth/signup', toSignupRequest(input), { auth: false }),
      '회원가입에 실패했습니다. 잠시 후 다시 시도해 주세요.',
    );
    return toUser(response);
  },

  // Restoring runs before AuthProvider exposes the token to apiClient, so the header is set here.
  // A 401 is handled by AuthProvider itself, not apiClient's onUnauthorized.
  getCurrentUser: async (accessToken) => {
    const response = await toAuthError(
      apiClient.get<UserInfoResponse>('/users/me', {
        auth: false,
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
      '로그인 정보를 확인하지 못했습니다. 다시 시도해 주세요.',
      '인증 정보가 유효하지 않습니다. 다시 로그인해 주세요.',
    );
    return { user: toUser(response) };
  },

  // No logout API: the JWT stays valid until it expires, and AuthProvider already cleared the local session.
  logout: async () => undefined,
};
