import { ApiError, isAbortError } from './apiError';

type QueryValue = string | number | boolean | null | undefined;

export type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, QueryValue | QueryValue[]>;
  headers?: HeadersInit;
  signal?: AbortSignal;
  // Set to false for public endpoints such as login and signup.
  auth?: boolean;
  timeoutMs?: number;
};

type ApiClientConfig = {
  baseUrl: string;
  timeoutMs: number;
  getAccessToken: () => string | null;
  onUnauthorized: (error: ApiError) => void;
};

const DEFAULT_TIMEOUT_MS = 15_000;

const config: ApiClientConfig = {
  // import.meta.env is undefined when modules are loaded outside Vite (Playwright unit tests).
  baseUrl: (import.meta.env?.VITE_API_BASE_URL ?? '').replace(/\/+$/, ''),
  timeoutMs: positiveNumber(import.meta.env?.VITE_API_TIMEOUT_MS) ?? DEFAULT_TIMEOUT_MS,
  getAccessToken: () => null,
  onUnauthorized: () => undefined,
};

export function configureApiClient(next: Partial<ApiClientConfig>) {
  Object.assign(config, next);
}

export function buildApiUrl(path: string, query?: ApiRequestOptions['query']) {
  const url = /^https?:\/\//.test(path) ? path : `${config.baseUrl}/${path.replace(/^\/+/, '')}`;
  if (!query) return url;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== null && item !== undefined) params.append(key, String(item));
    }
  }
  const search = params.toString();
  return search ? `${url}${url.includes('?') ? '&' : '?'}${search}` : url;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { auth = true, body, headers, method = 'GET', query, signal, timeoutMs = config.timeoutMs } = options;
  const requestHeaders = new Headers(headers);
  requestHeaders.set('Accept', 'application/json');

  const accessToken = auth ? config.getAccessToken() : null;
  if (accessToken) requestHeaders.set('Authorization', `Bearer ${accessToken}`);

  let requestBody: BodyInit | undefined;
  if (body instanceof FormData || body instanceof Blob || body instanceof URLSearchParams) {
    requestBody = body;
  } else if (body !== undefined) {
    requestHeaders.set('Content-Type', 'application/json');
    requestBody = JSON.stringify(body);
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const abortFromCaller = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', abortFromCaller, { once: true });

  let response: Response;
  try {
    response = await fetch(buildApiUrl(path, query), {
      method,
      headers: requestHeaders,
      body: requestBody,
      signal: controller.signal,
    });
  } catch (error) {
    if (timedOut) throw new ApiError({ kind: 'TIMEOUT', status: 0 });
    // Caller-initiated aborts are not failures; let callers ignore them with isAbortError.
    if (signal?.aborted || isAbortError(error)) throw error;
    throw new ApiError({ kind: 'NETWORK', status: 0 });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abortFromCaller);
  }

  const payload = await readPayload(response);

  if (!response.ok) {
    const error = createErrorFromPayload(response.status, payload);
    // Only an authenticated request proves the stored session is no longer valid.
    if (error.kind === 'UNAUTHORIZED' && accessToken) config.onUnauthorized(error);
    throw error;
  }

  // The backend returns DTOs as the body without a success envelope.
  return payload as T;
}

export const apiClient = {
  get: <T>(path: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...options, body, method: 'POST' }),
  put: <T>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...options, body, method: 'PUT' }),
  patch: <T>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...options, body, method: 'PATCH' }),
  delete: <T>(path: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...options, method: 'DELETE' }),
};

async function readPayload(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const text = await response.text().catch(() => '');
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// GlobalExceptionHandler body: { status: "ERROR", code, message, timestamp, path }.
// Unhandled exceptions use Spring's default body without code/message, so the status copy applies.
function createErrorFromPayload(status: number, payload: unknown) {
  if (!isRecord(payload)) return new ApiError({ status });

  return new ApiError({
    status,
    code: readString(payload.code),
    message: readString(payload.message)?.trim(),
    timestamp: readString(payload.timestamp),
    path: readString(payload.path),
  });
}

function readString(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function positiveNumber(value: string | undefined) {
  const parsed = Number(value);
  return value && Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
