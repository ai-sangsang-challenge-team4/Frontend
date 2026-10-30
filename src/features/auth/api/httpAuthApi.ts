import { apiClient, getApiErrorMessage, isApiError } from '../../../shared/api';
import type { User } from '../../../shared/types';
import { isUser, toSignupRequest } from '../authState';
import { AuthApiError, type AuthApi } from './authApiContract';
import { readAuthSession } from './authStorage';
import type {
  LoginResponse,
  PolicyConsentRequest,
  PolicyConsentResponse,
  SignupResponse,
  UserInfoResponse,
} from './authTypes';

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

type JwtClaims = { sub?: unknown; email?: unknown; role?: unknown; exp?: unknown };

function readJwtClaims(accessToken: string): JwtClaims | null {
  const payload = accessToken.split('.')[1];
  if (!payload) return null;
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=');
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const claims: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return claims && typeof claims === 'object' ? claims as JwtClaims : null;
  } catch {
    return null;
  }
}

// Workaround: GET /users/me answers 500 for every valid token (UserController takes
// @AuthenticationPrincipal Long while the principal is UserDetails). Until the backend fixes it, a server
// error keeps the user saved at login when the token still names that user and has not expired.
// The claims are not verified here; every other request still sends the token, and a 401 signs out.
export function fallbackUserForToken(accessToken: string, stored: { accessToken: string; user: User } | null, now = Date.now()) {
  if (!stored || stored.accessToken !== accessToken) return null;
  const claims = readJwtClaims(accessToken);
  if (!claims || typeof claims.exp !== 'number' || claims.exp * 1000 <= now) return null;
  const { user } = stored;
  return String(claims.sub) === String(user.userId) && claims.email === user.email && claims.role === user.role
    ? user
    : null;
}

export const httpAuthApi: AuthApi = {
  login: async (input) => {
    const response = await toAuthError(
      apiClient.post<LoginResponse>('/auth/login', { email: input.email.trim(), password: input.password }, { auth: false }),
      '로그인하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    );
    // An unusable token or expiry would show a signed-in user whose requests all fail or who is signed out at once.
    if (typeof response.accessToken !== 'string' || !response.accessToken.trim() ||
      !Number.isFinite(response.expiresIn) || response.expiresIn <= 0) {
      throw new AuthApiError({ code: 'INVALID_LOGIN_RESPONSE', message: '로그인 정보를 확인하지 못했습니다. 다시 시도해 주세요.', status: 502 });
    }
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
    const request = apiClient.get<UserInfoResponse>('/users/me', {
      auth: false,
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch((error: unknown) => {
      const user = isApiError(error) && error.status >= 500 ? fallbackUserForToken(accessToken, readAuthSession()) : null;
      if (user) return user;
      throw error;
    });
    const response = await toAuthError(
      request,
      '로그인 정보를 확인하지 못했습니다. 다시 시도해 주세요.',
      '인증 정보가 유효하지 않습니다. 다시 로그인해 주세요.',
    );
    return { user: toUser(response) };
  },

  // No logout API: the JWT stays valid until it expires, and AuthProvider already cleared the local session.
  logout: async () => undefined,

  agreeToCurrentPolicy: () =>
    toAuthError(
      apiClient.post<PolicyConsentResponse>('/users/me/policy-consents', { allAgreed: true } satisfies PolicyConsentRequest),
      '약관 동의를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    ),
};
