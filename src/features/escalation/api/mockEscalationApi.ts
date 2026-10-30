import { ApiError } from '../../../shared/api';
import type {
  EscalationScope,
  EscalationStatus,
  HistoryEventType,
  RiskLevel,
  RiskReviewDirection,
  UserRole,
} from '../../../shared/types';
import { readAuthSession } from '../../auth/api/authStorage';
import {
  ADMIN_MESSAGE_MAX_LENGTH,
  RISK_REVIEW_REASON_MAX_LENGTH,
  SHARE_REASON_MAX_LENGTH,
  SHAREABLE_RISK_LEVEL,
} from '../escalationRules';
import type {
  AdminEscalationSummaryResponse,
  ComplaintId,
  EmergencyReviewCreateRequest,
  EmergencyReviewResponse,
  EscalationComplaintSnapshot,
  EscalationStateResponse,
  HistoryEvent,
  TeacherRiskReviewResponse,
} from '../escalationTypes';
import { notifyEscalationsChanged, toServerComplaintId, type EscalationApi } from './escalationApiContract';

// v4 / reviews v2: scores moved from the teacher's 1~7 to the server's 0~70, so older entries are ignored.
export const MOCK_ESCALATION_STORAGE_KEY = 'teacher-hub.escalations.v4';
export const MOCK_EMERGENCY_REVIEW_STORAGE_KEY = 'teacher-hub.emergency-reviews.v2';
const MOCK_DELAY_MS = 300;

// The server assigns the first admin when adminId is null. Matches the ADMIN account in mockAuthApi.
const DEFAULT_ADMIN_ID = 301;
const DEFAULT_ADMIN_NAME = '관리자 사용자';
const EMERGENCY_REVIEW_MAX_SCORE = 6;

// The server keeps emergency reviews per complaint, apart from the share.
type StoredEmergencyReview = Omit<EmergencyReviewResponse, 'complaintId'> & { complaintId: string };

type StoredEscalation = {
  assignedAdminId: number;
  complaintId: string;
  currentRiskLevel: RiskLevel;
  currentRiskScore: number;
  escalationId: number;
  escalationStatus: EscalationStatus;
  events: HistoryEvent[];
  reason: string;
  scopes: EscalationScope[];
  sharedAt: string;
  sharedBy: number;
  sharedByName: string;
  snapshot: EscalationComplaintSnapshot;
};

function readStore(): StoredEscalation[] {
  try {
    const value = JSON.parse(localStorage.getItem(MOCK_ESCALATION_STORAGE_KEY) ?? '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeStore(items: StoredEscalation[]) {
  try {
    localStorage.setItem(MOCK_ESCALATION_STORAGE_KEY, JSON.stringify(items));
  } catch {
    throw new ApiError({ status: 503, message: '공유 정보를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.' });
  }
  notifyEscalationsChanged();
}

function replaceStored(store: StoredEscalation[], next: StoredEscalation) {
  writeStore(store.map((entry) => entry.escalationId === next.escalationId ? next : entry));
}

function readReviews(): StoredEmergencyReview[] {
  try {
    const value = JSON.parse(localStorage.getItem(MOCK_EMERGENCY_REVIEW_STORAGE_KEY) ?? '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeReviews(items: StoredEmergencyReview[]) {
  try {
    localStorage.setItem(MOCK_EMERGENCY_REVIEW_STORAGE_KEY, JSON.stringify(items));
  } catch {
    throw new ApiError({ status: 503, message: '재검토 요청을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.' });
  }
  notifyEscalationsChanged();
}

// findFirstByComplaintIdOrderByRequestedAtDescIdDesc
function latestReview(reviews: StoredEmergencyReview[], complaintId: ComplaintId) {
  return reviews.filter((review) => review.complaintId === String(complaintId)).at(-1) ?? null;
}

// Current safety lock belongs to the latest request, including after a rejection and retry.
function isSafetyLocked(reviews: StoredEmergencyReview[], complaintId: ComplaintId) {
  return latestReview(reviews, complaintId)?.safetyLock ?? false;
}

function toEmergencyReview(review: StoredEmergencyReview): EmergencyReviewResponse {
  return { ...review, complaintId: mockComplaintNumber(review.complaintId) };
}

function wait(signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Request aborted', 'AbortError'));
      return;
    }
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException('Request aborted', 'AbortError'));
    };
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, MOCK_DELAY_MS);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

// The server derives the caller from the access token; the mock reads the stored session.
function requireUser(role: UserRole) {
  const user = readAuthSession()?.user;
  if (!user) throw new ApiError({ status: 401 });
  if (user.role !== role) throw new ApiError({ status: 403 });
  return user;
}

// Mock stand-in for the server's 0~70 score → level rule. The UI never uses this for saved state.
function mockScoreToLevel(score: number): RiskLevel {
  if (score <= 20) return 'LOW';
  if (score <= 40) return 'MEDIUM';
  if (score <= 60) return 'HIGH';
  return 'EMERGENCY';
}

// Stored scores are 0~70 like the server's; requests carry the teacher's 1~7 choice, stored ×10.
// Every mock score is a choice ×10 (the inbox snapshot sends one too), so dividing gives the choice back.
const toMockScore = (scale: number) => scale * 10;
const toMockScale = (score: number) => Math.round(score / 10);

// Mock inbox thread IDs are strings; the spec's complaintId is numeric.
function mockComplaintNumber(complaintId: string) {
  return toServerComplaintId(complaintId) ?? (Number(complaintId.replace(/\D/g, '')) || 0);
}

function createEvent(
  item: Pick<StoredEscalation, 'escalationId' | 'events'>,
  type: HistoryEventType,
  actorName: string,
  fields: Partial<HistoryEvent> = {},
): HistoryEvent {
  return {
    actorName,
    eventId: `${item.escalationId}-${item.events.length + 1}`,
    newStatus: null,
    occurredAt: new Date().toISOString(),
    previousRiskLevel: null,
    previousRiskScore: null,
    previousStatus: null,
    reason: null,
    riskLevel: null,
    riskScore: null,
    type,
    ...fields,
  };
}

// Like EscalationStateResponse.from: emergency review fields come from the latest request.
function toState(item: StoredEscalation, reviews = readReviews()): EscalationStateResponse {
  const review = latestReview(reviews, item.complaintId);
  return {
    currentRiskLevel: item.currentRiskLevel,
    currentRiskScore: item.currentRiskScore,
    emergencyReviewRequestId: review?.requestId ?? null,
    escalationId: item.escalationId,
    escalationStatus: item.escalationStatus,
    riskReviewStatus: review?.status ?? null,
    safetyLock: review?.safetyLock ?? false,
  };
}

function toSummary(item: StoredEscalation, reviews = readReviews()): AdminEscalationSummaryResponse {
  const review = latestReview(reviews, item.complaintId);
  return {
    complaintId: mockComplaintNumber(item.complaintId),
    currentRiskLevel: item.currentRiskLevel,
    emergencyReviewRequestId: review?.requestId ?? null,
    escalationId: item.escalationId,
    escalationStatus: item.escalationStatus,
    reason: item.reason,
    riskReviewStatus: review?.status ?? null,
    safetyLock: review?.safetyLock ?? false,
    sharedAt: item.sharedAt,
    sharedBy: item.sharedByName,
  };
}

// The current score and level: the share's record, else an applied emergency review, else the inbox snapshot.
function currentRisk(
  item: StoredEscalation | undefined,
  review: StoredEmergencyReview | null,
  snapshot: EscalationComplaintSnapshot | undefined,
) {
  if (item) return { level: item.currentRiskLevel, score: item.currentRiskScore };
  if (review?.status === 'APPLIED') return { level: review.requestedRiskLevel, score: review.requestedRiskScore };
  return snapshot ? { level: snapshot.riskLevel, score: snapshot.riskScore } : null;
}

// The server reports the latest applied teacher review; the mock reads it back from the share's history.
function latestAppliedReview(item: StoredEscalation) {
  const event = item.events.filter((entry) => entry.type === 'RISK_REVIEWED').at(-1);
  if (!event || event.riskScore == null || event.riskLevel == null) return null;
  const previous = event.previousRiskScore ?? event.riskScore;
  const direction: RiskReviewDirection =
    event.riskScore < previous ? 'LOWERED' : event.riskScore > previous ? 'RAISED' : 'UNCHANGED';
  return { direction, event, level: event.riskLevel, score: event.riskScore };
}

function appendEvent(complaintId: ComplaintId, type: HistoryEventType, actorName: string, fields: Partial<HistoryEvent>) {
  const store = readStore();
  const item = findByComplaint(store, complaintId);
  // History is read through the share; an unshared complaint has nowhere to show it in the mock.
  if (item) replaceStored(store, { ...item, events: [...item.events, createEvent(item, type, actorName, fields)] });
}

// EmergencyReviewService.request, in the same order of checks.
function createEmergencyReview(
  complaintId: ComplaintId,
  request: EmergencyReviewCreateRequest,
  teacherName: string,
  snapshot: EscalationComplaintSnapshot | undefined,
) {
  const reason = request.reason?.trim() ?? '';
  if (!reason) {
    throw new ApiError({ status: 400, code: 'RISK_REVIEW_REASON_REQUIRED', message: 'Emergency 재검토 사유가 필요합니다.' });
  }
  if (reason.length > RISK_REVIEW_REASON_MAX_LENGTH) {
    throw new ApiError({ status: 400, code: 'VALIDATION_FAILED', message: '재검토 사유는 300자 이하로 입력해주세요.' });
  }
  if (!Number.isInteger(request.riskScore) || request.riskScore < 1 || request.riskScore > EMERGENCY_REVIEW_MAX_SCORE) {
    throw new ApiError({
      status: 409,
      code: 'RISK_REVIEW_NOT_ALLOWED',
      message: 'Emergency 재검토 요청 점수는 1점 이상 6점 이하여야 합니다.',
    });
  }

  const reviews = readReviews();
  const forComplaint = reviews.filter((review) => review.complaintId === String(complaintId));
  if (forComplaint.some((review) => review.status === 'PENDING_ADMIN_APPROVAL')) {
    throw new ApiError({
      status: 409,
      code: 'EMERGENCY_REVIEW_DUPLICATE',
      message: '이미 처리 중인 Emergency 재검토 요청이 있습니다.',
    });
  }

  const item = findByComplaint(readStore(), complaintId);
  const previous = currentRisk(item, forComplaint.at(-1) ?? null, snapshot);
  if (!previous) throw new ApiError({ status: 404, code: 'COMPLAINT_NOT_FOUND', message: '민원을 찾을 수 없습니다.' });
  if (previous.level !== 'EMERGENCY' || toMockScore(request.riskScore) >= previous.score) {
    throw new ApiError({
      status: 409,
      code: 'RISK_REVIEW_NOT_ALLOWED',
      message: '현재 Emergency 위험도를 하향하는 경우에만 재검토를 요청할 수 있습니다.',
    });
  }

  const requestedAt = new Date().toISOString();
  const created: StoredEmergencyReview = {
    complaintId: String(complaintId),
    decidedAt: null,
    previousRiskLevel: previous.level,
    previousRiskScale: toMockScale(previous.score),
    previousRiskScore: previous.score,
    reason,
    requestId: Math.max(500, ...reviews.map((review) => review.requestId)) + 1,
    requestedAt,
    requestedRiskLevel: mockScoreToLevel(toMockScore(request.riskScore)),
    requestedRiskScale: request.riskScore,
    requestedRiskScore: toMockScore(request.riskScore),
    reviewerId: request.reviewerId ?? item?.assignedAdminId ?? DEFAULT_ADMIN_ID,
    reviewerName: DEFAULT_ADMIN_NAME,
    riskAnalysisId: 1,
    safetyLock: true,
    safetyLockUpdatedAt: requestedAt,
    status: 'PENDING_ADMIN_APPROVAL',
  };
  writeReviews([...reviews, created]);
  appendEvent(complaintId, 'EMERGENCY_REVIEW_REQUESTED', teacherName, { reason });
  return created;
}

function requireAssignedReview(reviews: StoredEmergencyReview[], requestId: number, adminId: number) {
  const review = reviews.find((entry) => entry.requestId === requestId);
  if (!review) {
    throw new ApiError({ status: 404, code: 'EMERGENCY_REVIEW_NOT_FOUND', message: 'Emergency 재검토 요청을 찾을 수 없습니다.' });
  }
  if (review.reviewerId !== adminId) {
    throw new ApiError({
      status: 403,
      code: 'EMERGENCY_REVIEW_ACCESS_DENIED',
      message: '지정 검토자만 Emergency 재검토 요청을 처리할 수 있습니다.',
    });
  }
  return review;
}

function findByComplaint(store: StoredEscalation[], complaintId: ComplaintId) {
  return store.filter((item) => item.complaintId === String(complaintId)).at(-1);
}

function requireAssigned(store: StoredEscalation[], escalationId: number, adminId: number) {
  const item = store.find((entry) => entry.escalationId === escalationId);
  if (!item) throw new ApiError({ status: 404, message: '공유 건을 찾을 수 없습니다.' });
  if (item.assignedAdminId !== adminId) throw new ApiError({ status: 403 });
  return item;
}

// The backend rejects a blank message (@NotBlank) even though the spec shows minLength 0.
function readMessage(message: string) {
  const value = message.trim();
  if (!value) throw new ApiError({ status: 400, message: '관리자 메시지를 입력해주세요.' });
  if (value.length > ADMIN_MESSAGE_MAX_LENGTH) {
    throw new ApiError({ status: 400, message: `관리자 메시지는 ${ADMIN_MESSAGE_MAX_LENGTH}자 이하로 입력해주세요.` });
  }
  return value;
}

function requireStatus(item: StoredEscalation, expected: EscalationStatus) {
  if (item.escalationStatus !== expected) {
    throw new ApiError({
      status: 409,
      message: `공유 건 상태를 ${expected}에서만 변경할 수 있습니다. 현재 상태: ${item.escalationStatus}`,
    });
  }
}

function hasSameShare(item: StoredEscalation, adminId: number, scopes: EscalationScope[], reason: string) {
  return item.assignedAdminId === adminId &&
    item.scopes.length === scopes.length &&
    scopes.every((scope) => item.scopes.includes(scope)) &&
    item.reason === reason;
}

export const mockEscalationApi: EscalationApi = {
  async getEscalationState(complaintId, options) {
    await wait(options?.signal);
    requireUser('TEACHER');
    const reviews = readReviews();
    const item = findByComplaint(readStore(), complaintId);
    if (item) return toState(item, reviews);
    const review = latestReview(reviews, complaintId);
    const risk = currentRisk(undefined, review, options?.snapshot);
    if (!risk) throw new ApiError({ status: 404, code: 'COMPLAINT_NOT_FOUND', message: '민원을 찾을 수 없습니다.' });
    return {
      currentRiskLevel: risk.level,
      currentRiskScore: risk.score,
      emergencyReviewRequestId: review?.requestId ?? null,
      escalationId: null,
      escalationStatus: 'NOT_SHARED',
      riskReviewStatus: review?.status ?? null,
      safetyLock: review?.safetyLock ?? false,
    };
  },

  async shareEscalation(complaintId, request, options) {
    await wait(options?.signal);
    const teacher = requireUser('TEACHER');
    const reason = request.reason.trim();
    if (!reason) throw new ApiError({ status: 400, message: '공유 사유를 입력해주세요.' });
    if (reason.length > SHARE_REASON_MAX_LENGTH) {
      throw new ApiError({ status: 400, message: `공유 사유는 ${SHARE_REASON_MAX_LENGTH}자 이하로 입력해주세요.` });
    }
    const { snapshot } = options ?? {};
    if (!snapshot) throw new ApiError({ status: 404, message: '민원을 찾을 수 없습니다.' });
    const shareRisk = currentRisk(undefined, latestReview(readReviews(), complaintId), snapshot) ??
      { level: snapshot.riskLevel, score: snapshot.riskScore };
    if (shareRisk.level !== SHAREABLE_RISK_LEVEL) {
      throw new ApiError({ status: 409, message: 'EMERGENCY 위험도의 민원만 관리자에게 공유할 수 있습니다.' });
    }

    // One share per complaint: the same request is a no-op, a different one is rejected.
    const store = readStore();
    const adminId = request.adminId ?? DEFAULT_ADMIN_ID;
    const scopes = Array.from(new Set<EscalationScope>(['MASKING_MESSAGES', ...request.scopes]));
    const existing = findByComplaint(store, complaintId);
    if (existing) {
      if (hasSameShare(existing, adminId, scopes, reason)) return;
      throw new ApiError({ status: 409, message: '이미 다른 내용으로 공유된 민원입니다.' });
    }

    const base = {
      escalationId: Math.max(1100, ...store.map((item) => item.escalationId)) + 1,
      events: [],
    };
    const created: StoredEscalation = {
      ...base,
      assignedAdminId: adminId,
      complaintId: String(complaintId),
      currentRiskLevel: shareRisk.level,
      currentRiskScore: shareRisk.score,
      escalationStatus: 'SHARED',
      events: [createEvent(base, 'ESCALATION_SHARED', teacher.name, { reason })],
      reason,
      scopes,
      sharedAt: new Date().toISOString(),
      sharedBy: teacher.userId,
      sharedByName: teacher.name,
      snapshot,
    };
    writeStore([...store, created]);
  },

  async submitRiskReview(complaintId, request, options) {
    await wait(options?.signal);
    const teacher = requireUser('TEACHER');
    const { riskScore } = request;
    const reason = request.reason?.trim() ?? '';
    if (!Number.isInteger(riskScore) || riskScore < 1) {
      throw new ApiError({ status: 400, message: '위험 점수는 1점 이상이어야 합니다.' });
    }
    if (riskScore > 7) throw new ApiError({ status: 400, message: '위험 점수는 7점 이하여야 합니다.' });
    if (reason.length > RISK_REVIEW_REASON_MAX_LENGTH) {
      throw new ApiError({ status: 400, message: `검토 사유는 ${RISK_REVIEW_REASON_MAX_LENGTH}자 이하로 입력해주세요.` });
    }

    const store = readStore();
    const item = findByComplaint(store, complaintId);
    const reviews = readReviews();
    const previous = currentRisk(item, latestReview(reviews, complaintId), options?.snapshot);
    if (!previous) throw new ApiError({ status: 404, code: 'COMPLAINT_NOT_FOUND', message: '민원을 찾을 수 없습니다.' });

    const previousScale = toMockScale(previous.score);
    const direction: RiskReviewDirection =
      riskScore < previousScale ? 'LOWERED' : riskScore > previousScale ? 'RAISED' : 'UNCHANGED';
    if (direction === 'LOWERED' && !reason) {
      throw new ApiError({
        status: 400,
        code: 'RISK_REVIEW_REASON_REQUIRED',
        message: '위험도를 하향 조정할 때는 검토 사유가 필요합니다.',
      });
    }

    const reviewedScore = toMockScore(riskScore);
    const riskLevel = mockScoreToLevel(reviewedScore);
    const base = {
      complaintId: mockComplaintNumber(String(complaintId)),
      direction,
      previousLevel: previous.level,
      previousScale,
      previousScore: previous.score,
      ...(reason ? { reason } : {}),
      reviewScale: riskScore,
      reviewedBy: teacher.name,
      riskAnalysisId: 1,
      riskLevel,
      riskScore: reviewedScore,
    };

    // Like the backend, changing an EMERGENCY score opens an emergency review instead of applying it.
    // It no longer needs a share first.
    if (previous.level === 'EMERGENCY' && riskScore !== previousScale) {
      const review = createEmergencyReview(complaintId, { reason, riskScore }, teacher.name, options?.snapshot);
      return {
        ...base,
        emergencyReviewRequestId: review.requestId,
        reviewedAt: review.requestedAt,
        safetyLock: true,
        status: 'PENDING_ADMIN_APPROVAL',
      } satisfies TeacherRiskReviewResponse;
    }

    if (item) {
      replaceStored(store, {
        ...item,
        currentRiskLevel: riskLevel,
        currentRiskScore: reviewedScore,
        events: [...item.events, createEvent(item, 'RISK_REVIEWED', teacher.name, {
          previousRiskLevel: previous.level,
          previousRiskScore: previous.score,
          reason: reason || null,
          riskLevel,
          riskScore: reviewedScore,
        })],
      });
    }

    return {
      ...base,
      reviewedAt: new Date().toISOString(),
      riskReviewId: Date.now(),
      safetyLock: isSafetyLocked(reviews, complaintId),
      status: 'APPLIED',
    } satisfies TeacherRiskReviewResponse;
  },

  async requestEmergencyReview(complaintId, request, options) {
    await wait(options?.signal);
    const teacher = requireUser('TEACHER');
    return toEmergencyReview(createEmergencyReview(complaintId, request, teacher.name, options?.snapshot));
  },

  async getCurrentEmergencyReview(complaintId, options) {
    await wait(options?.signal);
    requireUser('TEACHER');
    const review = latestReview(readReviews(), complaintId);
    return review ? toEmergencyReview(review) : null;
  },

  async listMyEscalations(signal) {
    await wait(signal);
    const teacher = requireUser('TEACHER');
    return readStore()
      .filter((item) => item.sharedBy === teacher.userId)
      .sort((left, right) => right.sharedAt.localeCompare(left.sharedAt))
      .map((item) => ({
        complaintId: item.complaintId,
        escalationId: item.escalationId,
        escalationStatus: item.escalationStatus,
        sharedAt: item.sharedAt,
        title: item.snapshot.title,
      }));
  },

  async listAdminEscalations(query = {}, signal) {
    await wait(signal);
    const admin = requireUser('ADMIN');
    return readStore()
      .filter((item) => item.assignedAdminId === admin.userId)
      .filter((item) => !query.status || item.escalationStatus === query.status)
      .filter((item) => !query.riskLevel || item.currentRiskLevel === query.riskLevel)
      .sort((left, right) => right.sharedAt.localeCompare(left.sharedAt))
      .map((item) => toSummary(item));
  },

  async getAdminEscalation(escalationId, signal) {
    await wait(signal);
    const admin = requireUser('ADMIN');
    return toSummary(requireAssigned(readStore(), escalationId, admin.userId));
  },

  // Only the scopes the teacher chose leave the server.
  async getAdminEscalationMessages(escalationId, signal) {
    await wait(signal);
    const admin = requireUser('ADMIN');
    const item = requireAssigned(readStore(), escalationId, admin.userId);
    return {
      maskedMessages: item.snapshot.maskedMessages,
      mediationPackageIncluded: item.scopes.includes('MEDIATION_PACKAGE'),
      originalMessages: item.scopes.includes('ORIGINAL_MESSAGES') ? item.snapshot.originalMessages : [],
      reason: item.reason,
    };
  },

  async getAdminEscalationRisk(escalationId, signal) {
    await wait(signal);
    const admin = requireUser('ADMIN');
    const item = requireAssigned(readStore(), escalationId, admin.userId);
    const review = latestAppliedReview(item);
    return {
      analyzedAt: item.sharedAt,
      complaintId: mockComplaintNumber(item.complaintId),
      detectedFactors: item.snapshot.detectedFactors,
      currentRiskLevel: item.currentRiskLevel,
      currentRiskScore: item.currentRiskScore,
      latestReview: review ? {
        direction: review.direction,
        reason: review.event.reason ?? '',
        reviewedAt: review.event.occurredAt,
        reviewedBy: review.event.actorName ?? '',
        riskReviewId: Date.parse(review.event.occurredAt),
      } : null,
      reviewLevel: review?.level ?? null,
      reviewScale: review ? toMockScale(review.score) : null,
      reviewScore: review?.score ?? null,
      riskAnalysisId: 1,
      riskLevel: item.snapshot.riskLevel,
      riskScore: item.snapshot.riskScore,
      safetyLock: isSafetyLocked(readReviews(), item.complaintId),
    };
  },

  async getAdminEscalationHistory(escalationId, signal) {
    await wait(signal);
    const admin = requireUser('ADMIN');
    const item = requireAssigned(readStore(), escalationId, admin.userId);
    return { complaintId: mockComplaintNumber(item.complaintId), logComplete: true, missingLogs: [], events: item.events };
  },

  async startEscalationReview(escalationId, request, signal) {
    await wait(signal);
    const admin = requireUser('ADMIN');
    const store = readStore();
    const item = requireAssigned(store, escalationId, admin.userId);
    const message = readMessage(request.message);
    requireStatus(item, 'SHARED');
    const next: StoredEscalation = {
      ...item,
      escalationStatus: 'UNDER_REVIEW',
      events: [...item.events, createEvent(item, 'ESCALATION_REVIEW_STARTED', admin.name, { reason: message })],
    };
    replaceStored(store, next);
    return toState(next);
  },

  async completeEscalation(escalationId, request, signal) {
    await wait(signal);
    const admin = requireUser('ADMIN');
    const store = readStore();
    const item = requireAssigned(store, escalationId, admin.userId);
    const message = readMessage(request.message);
    // The server checks the latest emergency review before the share's own state.
    if (latestReview(readReviews(), item.complaintId)?.status === 'PENDING_ADMIN_APPROVAL') {
      throw new ApiError({
        status: 409,
        code: 'ESCALATION_STATE_INVALID',
        message: 'Emergency 재검토 요청을 승인하거나 거부한 뒤 처리 완료할 수 있습니다.',
      });
    }
    requireStatus(item, 'UNDER_REVIEW');
    const next: StoredEscalation = {
      ...item,
      escalationStatus: 'COMPLETED',
      events: [...item.events, createEvent(item, 'ESCALATION_COMPLETED', admin.name, { reason: message })],
    };
    replaceStored(store, next);
    return toState(next);
  },

  async listAdminEmergencyReviews(signal) {
    await wait(signal);
    const admin = requireUser('ADMIN');
    return readReviews()
      .filter((review) => review.reviewerId === admin.userId)
      .reverse()
      .map(toEmergencyReview);
  },

  async getAdminEmergencyReview(requestId, signal) {
    await wait(signal);
    const admin = requireUser('ADMIN');
    return toEmergencyReview(requireAssignedReview(readReviews(), requestId, admin.userId));
  },

  // EmergencyReviewService.update: a decision only on a pending request; the lock changes on its own.
  async updateEmergencyReview(requestId, request, signal) {
    await wait(signal);
    const admin = requireUser('ADMIN');
    if (request.status === undefined && request.safetyLock === undefined) {
      throw new ApiError({ status: 400, code: 'INVALID_REQUEST', message: '요청 값이 올바르지 않습니다.' });
    }
    const message = request.message?.trim() || null;
    if (message && message.length > ADMIN_MESSAGE_MAX_LENGTH) {
      throw new ApiError({ status: 400, code: 'VALIDATION_FAILED', message: '검토자 메시지는 500자 이하로 입력해주세요.' });
    }
    const reviews = readReviews();
    const review = requireAssignedReview(reviews, requestId, admin.userId);
    if (request.status && review.status !== 'PENDING_ADMIN_APPROVAL') {
      throw new ApiError({ status: 409, code: 'ESCALATION_STATE_INVALID', message: '이미 결정된 Emergency 재검토 요청입니다.' });
    }

    const now = new Date().toISOString();
    const lockChanged = request.safetyLock !== undefined && request.safetyLock !== review.safetyLock;
    const next: StoredEmergencyReview = {
      ...review,
      ...(request.status ? { decidedAt: now, status: request.status } : {}),
      ...(request.safetyLock !== undefined ? { safetyLock: request.safetyLock, safetyLockUpdatedAt: now } : {}),
    };
    writeReviews(reviews.map((entry) => entry.requestId === requestId ? next : entry));

    if (request.status === 'APPLIED') {
      // Approval saves the requested score as the teacher's review, so the share's current level drops.
      const store = readStore();
      const item = findByComplaint(store, review.complaintId);
      if (item) {
        replaceStored(store, {
          ...item,
          currentRiskLevel: review.requestedRiskLevel,
          currentRiskScore: review.requestedRiskScore,
          events: [...item.events, createEvent(item, 'RISK_REVIEWED', item.sharedByName, {
            previousRiskLevel: review.previousRiskLevel,
            previousRiskScore: review.previousRiskScore,
            reason: review.reason,
            riskLevel: review.requestedRiskLevel,
            riskScore: review.requestedRiskScore,
          })],
        });
      }
    }
    if (request.status) {
      appendEvent(review.complaintId, request.status === 'APPLIED' ? 'EMERGENCY_REVIEW_APPROVED' : 'EMERGENCY_REVIEW_REJECTED',
        admin.name, {
          reason: message ?? (request.status === 'APPLIED'
            ? 'Emergency 재검토 요청을 승인합니다.'
            : 'Emergency 재검토 요청을 거부합니다.'),
        });
    }
    if (lockChanged) {
      appendEvent(review.complaintId, 'EMERGENCY_SAFETY_LOCK_UPDATED', admin.name, {
        reason: message ?? (next.safetyLock ? '안전 잠금을 유지합니다.' : '안전 잠금을 해제합니다.'),
      });
    }
    return toEmergencyReview(next);
  },
};
