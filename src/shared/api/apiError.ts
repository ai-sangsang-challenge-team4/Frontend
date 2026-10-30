export type ApiErrorKind =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'SERVER'
  | 'NETWORK'
  | 'TIMEOUT'
  | 'UNKNOWN';

export type ApiErrorAction = 'back' | 'login' | 'home' | 'refresh' | 'retry';

export type ApiErrorCopy = {
  title: string;
  description: string;
  actionLabel: string;
  action: ApiErrorAction;
};

export const API_ERROR_COPY: Record<ApiErrorKind, ApiErrorCopy> = {
  BAD_REQUEST: {
    title: '요청을 처리할 수 없어요.',
    description: '입력하신 정보를 확인한 후 다시 시도해 주세요.',
    actionLabel: '이전으로',
    action: 'back',
  },
  UNAUTHORIZED: {
    title: '로그인이 필요해요.',
    description: '로그인 정보가 만료되었거나 확인되지 않아요. 다시 로그인해 주세요.',
    actionLabel: '로그인하기',
    action: 'login',
  },
  FORBIDDEN: {
    title: '접근할 수 없는 페이지예요.',
    description: '해당 페이지에 접근할 권한이 없어요.',
    actionLabel: '홈으로',
    action: 'home',
  },
  NOT_FOUND: {
    title: '페이지를 찾을 수 없어요.',
    description: '요청하신 페이지가 삭제되었거나 주소가 변경되었을 수 있어요.',
    actionLabel: '홈으로',
    action: 'home',
  },
  CONFLICT: {
    title: '요청을 완료할 수 없어요.',
    description: '현재 상태에서는 요청을 처리할 수 없어요. 최신 정보를 확인한 후 다시 시도해 주세요.',
    actionLabel: '새로고침',
    action: 'refresh',
  },
  SERVER: {
    title: '일시적인 문제가 발생했어요.',
    description: '서비스 이용에 불편을 드려 죄송해요. 잠시 후 다시 시도해 주세요.',
    actionLabel: '다시 시도하기',
    action: 'retry',
  },
  NETWORK: {
    title: '인터넷 연결이 원활하지 않아요.',
    description: '연결 상태를 확인한 후 다시 시도해 주세요.',
    actionLabel: '다시 시도하기',
    action: 'retry',
  },
  TIMEOUT: {
    title: '응답이 지연되고 있어요.',
    description: '잠시 후 다시 시도해 주세요.',
    actionLabel: '다시 시도하기',
    action: 'retry',
  },
  UNKNOWN: {
    title: '정보를 불러오지 못했어요.',
    description: '잠시 후 다시 시도해 주세요.',
    actionLabel: '다시 시도하기',
    action: 'retry',
  },
};

export const LOADING_MESSAGES = {
  default: '정보를 불러오고 있어요.',
  messageHistory: '문의 내역을 불러오고 있어요.',
  aiAnalysis: 'AI가 문의 내용을 분석하고 있어요.',
  replySending: '답변을 전송하고 있어요.',
} as const;

// Copy for backend error codes. Codes not listed fall back to the status copy.
// Codes are the ones GlobalExceptionHandler and the security handlers return (backend dev branch).
export const API_ERROR_CODE_MESSAGES: Record<string, string> = {
  // Common
  VALIDATION_FAILED: '입력하신 정보를 확인한 후 다시 시도해 주세요.',
  INVALID_REQUEST_BODY: '요청 내용을 확인한 후 다시 시도해 주세요.',
  INVALID_REQUEST_PARAMETER: '요청 정보를 확인한 후 다시 시도해 주세요.',
  INVALID_REQUEST: '요청 값이 올바르지 않아요. 입력하신 정보를 확인해 주세요.',
  INVALID_STATE: '현재 상태에서는 요청을 처리할 수 없어요. 최신 정보를 확인해 주세요.',
  DATA_CONFLICT: '이미 처리되었거나 현재 상태와 맞지 않는 요청이에요. 최신 정보를 확인해 주세요.',
  API_NOT_FOUND: '요청한 기능을 찾을 수 없어요.',
  ACCESS_DENIED: '접근 권한이 없어요.',
  // Signup
  SIGNUP_VALIDATION_FAILED: '입력하신 가입 정보를 확인해 주세요.',
  SIGNUP_REFERENCE_NOT_FOUND: '입력하신 학교·학급·학생 또는 교직원 정보를 찾을 수 없어요.',
  SIGNUP_CONFLICT: '이미 가입된 이메일이거나 이미 가입된 교직원이에요.',
  // Complaint (parent)
  EMPTY_COMPLAINT_CONTENT: '문의 내용을 입력해 주세요.',
  COMPLAINT_ACCESS_DENIED: '해당 문의를 확인할 권한이 없어요.',
  COMPLAINT_NOT_FOUND: '문의 내역을 찾을 수 없어요.',
  STUDENT_NOT_FOUND: '학생 정보를 찾을 수 없어요.',
  INVALID_COMPLAINT_RECIPIENT: '문의를 보낼 수 있는 선생님이 아니에요. 받는 선생님을 다시 선택해 주세요.',
  RISK_ANALYSIS_NOT_FOUND: '분석 결과를 찾을 수 없어요.',
  ANALYSIS_REQUIRED: 'AI 분석과 수정안 확인을 마친 후 제출해 주세요.',
  FINAL_ANALYSIS_ON_SUBMIT: '수정한 내용은 제출할 때 다시 분석돼요. 제출하기를 눌러 주세요.',
  REANALYSIS_LIMIT_REACHED: '재분석은 한 번만 할 수 있어요. 재분석 후에는 내용을 수정할 수 없어요.',
  COMPLAINT_NOT_DRAFT: '이미 제출된 문의는 수정하거나 다시 제출할 수 없어요.',
  MESSAGE_DRAFT_NOT_FOUND: '작성 중인 메시지를 찾을 수 없어요.',
  MESSAGE_NOT_EDITABLE: '이미 전송된 메시지는 수정할 수 없어요.',
  // Teacher reply and risk review
  RESPONSE_DRAFT_NOT_FOUND: '임시저장한 답변을 찾을 수 없어요.',
  // The server answers this whenever the complaint is not OPEN and waiting for the teacher.
  RESPONSE_NOT_EDITABLE: '지금은 답변할 수 없는 문의예요. 이미 답변했거나 상담이 끝났는지 확인해 주세요.',
  RISK_REVIEW_REASON_REQUIRED: '위험도를 낮출 때는 검토 사유를 입력해 주세요.',
  RISK_REVIEW_NOT_ALLOWED: '현재 상태에서는 위험도를 검토할 수 없어요.',
  // Admin share and emergency review
  ADMIN_NOT_FOUND: '공유할 관리자를 찾을 수 없어요.',
  ESCALATION_NOT_FOUND: '공유 건을 찾을 수 없어요.',
  ESCALATION_ACCESS_DENIED: '공유받지 않은 메시지는 확인할 수 없어요.',
  ESCALATION_REASON_REQUIRED: '공유 사유를 입력해 주세요.',
  ESCALATION_NOT_ALLOWED: '관리자에게 공유할 수 없는 메시지예요.',
  ESCALATION_STATE_INVALID: '현재 처리 상태에서는 요청을 처리할 수 없어요. 최신 정보를 확인해 주세요.',
  ESCALATION_VERSION_CONFLICT: '다른 요청에서 데이터가 변경되었어요. 최신 상태를 다시 확인해 주세요.',
  EMERGENCY_REVIEW_DUPLICATE: '이미 처리 중이거나 안전 잠금이 유지 중인 재검토 요청이 있어요.',
  EMERGENCY_REVIEW_NOT_FOUND: '재검토 요청을 찾을 수 없어요.',
  EMERGENCY_REVIEW_ACCESS_DENIED: '지정된 검토자만 재검토 요청을 처리할 수 있어요.',
  // API 명세서에 있었지만 백엔드(dev)에서 반환하지 않는 코드. 백엔드 코드에서 사용처를 찾지 못했습니다.
  // COMPLAINT_EDIT_LIMIT_REACHED는 docs/risk-api.md에서 "직접 수정 횟수 제한 없음"으로 바뀌었습니다.
  USER_NOT_FOUND: '회원 정보를 찾을 수 없어요.',
  EMAIL_ALREADY_EXISTS: '이미 가입된 이메일이에요.',
  TEACHER_NOT_FOUND: '선생님 정보를 찾을 수 없어요.',
  INVALID_COMPLAINT_STATUS: '이미 처리되었거나 현재 상태에서는 처리할 수 없는 문의예요.',
  ANALYSIS_IN_PROGRESS: 'AI가 문의 내용을 분석하고 있어요. 잠시 후 다시 확인해 주세요.',
  ANALYSIS_ACCESS_DENIED: '해당 분석 결과를 확인할 권한이 없어요.',
  RISK_ANALYSIS_FAILED: 'AI 분석을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.',
  RESPONSE_NOT_FOUND: '답변을 찾을 수 없어요.',
  RESPONSE_ALREADY_EXISTS: '이미 전송된 답변이에요.',
  RESPONSE_ACCESS_DENIED: '해당 답변을 확인할 권한이 없어요.',
  INVALID_STATUS_TRANSITION: '문의 상태가 변경되어 요청을 처리할 수 없어요. 최신 정보를 확인해 주세요.',
  COMPLAINT_EDIT_LIMIT_REACHED: '문의 내용은 한 번만 수정할 수 있어요.',
};

// The server's message names the exact reason for these codes (which field failed, which state blocks
// the action), so it is shown as-is and the copy above is only the fallback.
// e.g. SIGNUP_VALIDATION_FAILED "학생 번호와 자녀 이름이 일치하지 않습니다."
const SERVER_MESSAGE_FIRST_CODES = new Set([
  'VALIDATION_FAILED',
  'SIGNUP_VALIDATION_FAILED',
  'SIGNUP_REFERENCE_NOT_FOUND',
  'SIGNUP_CONFLICT',
  'RISK_REVIEW_REASON_REQUIRED',
  'RISK_REVIEW_NOT_ALLOWED',
  'ESCALATION_NOT_ALLOWED',
  'ESCALATION_STATE_INVALID',
  'ESCALATION_ACCESS_DENIED',
  'EMERGENCY_REVIEW_DUPLICATE',
  'EMERGENCY_REVIEW_ACCESS_DENIED',
  'ADMIN_NOT_FOUND',
  // e.g. "이미 완료된 민원은 다시 완료 처리할 수 없습니다." on POST /teacher/complaints/{id}/close.
  'RESPONSE_NOT_EDITABLE',
]);

export const REPLY_SEND_FAILED_MESSAGE = '답변을 전송하지 못했어요. 내용을 확인한 후 다시 시도해 주세요.';

export class ApiError extends Error {
  kind: ApiErrorKind;
  status: number;
  code: string;
  // Message supplied by the server; null when only the default copy is available.
  serverMessage: string | null;
  timestamp: string | null;
  path: string | null;

  constructor({ code, kind, message, path, status, timestamp }: {
    code?: string;
    kind?: ApiErrorKind;
    message?: string | null;
    path?: string | null;
    status: number;
    timestamp?: string | null;
  }) {
    const resolvedKind = kind ?? getApiErrorKind(status);
    super(message || API_ERROR_COPY[resolvedKind].title);
    this.name = 'ApiError';
    this.kind = resolvedKind;
    this.status = status;
    this.code = code ?? resolvedKind;
    this.serverMessage = message || null;
    this.timestamp = timestamp ?? null;
    this.path = path ?? null;
  }
}

export function getApiErrorKind(status: number): ApiErrorKind {
  if (status === 400 || status === 422) return 'BAD_REQUEST';
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 408 || status === 504) return 'TIMEOUT';
  if (status >= 500) return 'SERVER';
  return 'UNKNOWN';
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}

export function toApiError(error: unknown): ApiError {
  if (isApiError(error)) return error;
  return new ApiError({ kind: 'UNKNOWN', status: 0 });
}

// 400/409 carry the rejection reason, and 401 carries the login failure reason
// ("이메일 또는 비밀번호가 올바르지 않습니다."), so the server's wording is worth showing.
// 404/403 stay on the fixed copy unless the code is in SERVER_MESSAGE_FIRST_CODES
// (e.g. SIGNUP_REFERENCE_NOT_FOUND), so a page-level 404 still reads as "not found".
function getServerReason(error: ApiError) {
  return ['BAD_REQUEST', 'UNAUTHORIZED', 'CONFLICT'].includes(error.kind) ? error.serverMessage : null;
}

function getCodeMessage(error: ApiError) {
  if (SERVER_MESSAGE_FIRST_CODES.has(error.code) && error.serverMessage) return error.serverMessage;
  return API_ERROR_CODE_MESSAGES[error.code];
}

export function getApiErrorCopy(error: unknown): ApiErrorCopy {
  const apiError = toApiError(error);
  const copy = API_ERROR_COPY[apiError.kind];
  const description = getCodeMessage(apiError) ?? getServerReason(apiError) ?? copy.description;
  return { ...copy, description };
}

// Short inline/toast message that keeps the user on the current form.
export function getApiErrorMessage(error: unknown, fallbackMessage = API_ERROR_COPY.UNKNOWN.title) {
  if (!isApiError(error)) return fallbackMessage;
  const copy = API_ERROR_COPY[error.kind];
  return getCodeMessage(error) ?? getServerReason(error) ?? `${copy.title} ${copy.description}`;
}
