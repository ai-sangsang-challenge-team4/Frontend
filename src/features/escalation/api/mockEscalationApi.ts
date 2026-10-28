import { ApiError } from '../../../shared/api';
import type {
  EscalationScope,
  EscalationStatus,
  HistoryEventType,
  RiskLevel,
  RiskReviewDirection,
  RiskReviewStatus,
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
  EscalationComplaintSnapshot,
  EscalationStateResponse,
  HistoryEvent,
} from '../escalationTypes';
import { notifyEscalationsChanged, toServerComplaintId, type EscalationApi } from './escalationApiContract';

// v2: the shape changed to the backend spec, so v1 entries are ignored.
export const MOCK_ESCALATION_STORAGE_KEY = 'teacher-hub.escalations.v2';
const MOCK_DELAY_MS = 300;

// The server assigns the first admin when adminId is null. Matches the ADMIN account in mockAuthApi.
const DEFAULT_ADMIN_ID = 301;

type PendingRiskChange = {
  previousLevel: RiskLevel;
  previousScore: number;
  riskLevel: RiskLevel;
  riskScore: number;
};

type StoredEscalation = {
  assignedAdminId: number;
  complaintId: string;
  currentRiskLevel: RiskLevel;
  currentRiskScore: number;
  escalationId: number;
  escalationStatus: EscalationStatus;
  events: HistoryEvent[];
  pendingRiskChange: PendingRiskChange | null;
  reason: string;
  riskReviewStatus: RiskReviewStatus | null;
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

// Mock stand-in for the server's score → level rule. The UI never uses this for saved state.
function mockScoreToLevel(score: number): RiskLevel {
  if (score <= 2) return 'LOW';
  if (score <= 4) return 'MEDIUM';
  if (score <= 6) return 'HIGH';
  return 'EMERGENCY';
}

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

function toState(item: StoredEscalation): EscalationStateResponse {
  return {
    currentRiskLevel: item.currentRiskLevel,
    currentRiskScore: item.currentRiskScore,
    escalationId: item.escalationId,
    escalationStatus: item.escalationStatus,
    riskReviewStatus: item.riskReviewStatus,
  };
}

function toSummary(item: StoredEscalation): AdminEscalationSummaryResponse {
  return {
    complaintId: mockComplaintNumber(item.complaintId),
    currentRiskLevel: item.currentRiskLevel,
    escalationId: item.escalationId,
    escalationStatus: item.escalationStatus,
    reason: item.reason,
    sharedAt: item.sharedAt,
    sharedBy: item.sharedByName,
  };
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
    const item = findByComplaint(readStore(), complaintId);
    if (item) return toState(item);
    if (!options?.snapshot) throw new ApiError({ status: 404, message: '민원을 찾을 수 없습니다.' });
    return {
      currentRiskLevel: options.snapshot.riskLevel,
      currentRiskScore: options.snapshot.riskScore,
      escalationId: null,
      escalationStatus: 'NOT_SHARED',
      riskReviewStatus: null,
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
    if (snapshot.riskLevel !== SHAREABLE_RISK_LEVEL) {
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
      currentRiskLevel: snapshot.riskLevel,
      currentRiskScore: snapshot.riskScore,
      escalationStatus: 'SHARED',
      events: [createEvent(base, 'ESCALATION_SHARED', teacher.name, { reason })],
      pendingRiskChange: null,
      reason,
      riskReviewStatus: null,
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
    const previous = item
      ? { level: item.currentRiskLevel, score: item.currentRiskScore }
      : options?.snapshot && { level: options.snapshot.riskLevel, score: options.snapshot.riskScore };
    if (!previous) throw new ApiError({ status: 404, message: '민원을 찾을 수 없습니다.' });

    const direction: RiskReviewDirection =
      riskScore < previous.score ? 'LOWERED' : riskScore > previous.score ? 'RAISED' : 'UNCHANGED';
    if (direction === 'LOWERED' && !reason) {
      throw new ApiError({ status: 400, message: '위험도를 하향 조정할 때는 검토 사유가 필요합니다.' });
    }

    const riskLevel = mockScoreToLevel(riskScore);
    // Like the backend, any change to an EMERGENCY score needs admin approval through the share.
    const changesEmergency = previous.level === 'EMERGENCY' && riskScore !== previous.score;
    let status: RiskReviewStatus = 'APPLIED';

    if (changesEmergency) {
      if (!item) {
        throw new ApiError({ status: 409, message: 'EMERGENCY 위험도 변경을 요청하려면 먼저 관리자에게 공유해야 합니다.' });
      }
      if (item.escalationStatus === 'COMPLETED') {
        throw new ApiError({ status: 409, message: '처리 완료된 공유 건에는 위험도 변경을 요청할 수 없습니다.' });
      }
      // A new request replaces a pending one, as the backend does.
      status = 'PENDING_ADMIN_APPROVAL';
      replaceStored(store, {
        ...item,
        events: [...item.events, createEvent(item, 'ESCALATION_RISK_CHANGE_REQUESTED', teacher.name, {
          previousRiskLevel: previous.level,
          previousRiskScore: previous.score,
          reason,
          riskLevel,
          riskScore,
        })],
        pendingRiskChange: { previousLevel: previous.level, previousScore: previous.score, riskLevel, riskScore },
        riskReviewStatus: status,
      });
    } else if (item) {
      replaceStored(store, {
        ...item,
        currentRiskLevel: riskLevel,
        currentRiskScore: riskScore,
        events: [...item.events, createEvent(item, 'RISK_REVIEWED', teacher.name, {
          previousRiskLevel: previous.level,
          previousRiskScore: previous.score,
          reason: reason || null,
          riskLevel,
          riskScore,
        })],
      });
    }

    return {
      complaintId: mockComplaintNumber(String(complaintId)),
      direction,
      previousLevel: previous.level,
      previousScore: previous.score,
      reason,
      reviewedAt: new Date().toISOString(),
      reviewedBy: teacher.name,
      riskAnalysisId: 1,
      riskLevel,
      riskReviewId: Date.now(),
      riskScore,
      status,
    };
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
      .map(toSummary);
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
    const isReviewed = item.currentRiskScore !== item.snapshot.riskScore;
    return {
      analyzedAt: item.sharedAt,
      complaintId: mockComplaintNumber(item.complaintId),
      detectedFactors: item.snapshot.detectedFactors,
      latestReview: null,
      reviewLevel: isReviewed ? item.currentRiskLevel : null,
      reviewScore: isReviewed ? item.currentRiskScore : null,
      riskAnalysisId: 1,
      riskLevel: item.snapshot.riskLevel,
      riskScore: item.snapshot.riskScore,
    };
  },

  async getAdminEscalationHistory(escalationId, signal) {
    await wait(signal);
    const admin = requireUser('ADMIN');
    const item = requireAssigned(readStore(), escalationId, admin.userId);
    return { complaintId: mockComplaintNumber(item.complaintId), events: item.events };
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
    requireStatus(item, 'UNDER_REVIEW');
    if (item.riskReviewStatus === 'PENDING_ADMIN_APPROVAL') {
      throw new ApiError({ status: 409, message: '위험도 변경 요청을 승인하거나 거부한 뒤 처리 완료할 수 있습니다.' });
    }
    const next: StoredEscalation = {
      ...item,
      escalationStatus: 'COMPLETED',
      events: [...item.events, createEvent(item, 'ESCALATION_COMPLETED', admin.name, { reason: message })],
    };
    replaceStored(store, next);
    return toState(next);
  },

  async decideRiskChange(escalationId, request, signal) {
    await wait(signal);
    const admin = requireUser('ADMIN');
    const store = readStore();
    const item = requireAssigned(store, escalationId, admin.userId);
    const message = readMessage(request.message);
    // Repeating the decision already made is a no-op on the backend.
    if (item.riskReviewStatus === request.status) return toState(item);
    requireStatus(item, 'UNDER_REVIEW');
    const pending = item.pendingRiskChange;
    if (item.riskReviewStatus !== 'PENDING_ADMIN_APPROVAL' || !pending) {
      throw new ApiError({ status: 409, message: '교사가 요청한 위험도 변경 건이 없습니다.' });
    }
    const isApplied = request.status === 'APPLIED';
    const next: StoredEscalation = {
      ...item,
      currentRiskLevel: isApplied ? pending.riskLevel : item.currentRiskLevel,
      currentRiskScore: isApplied ? pending.riskScore : item.currentRiskScore,
      events: [...item.events, createEvent(
        item,
        isApplied ? 'ESCALATION_RISK_CHANGE_APPROVED' : 'ESCALATION_RISK_CHANGE_REJECTED',
        admin.name,
        {
          previousRiskLevel: pending.previousLevel,
          previousRiskScore: pending.previousScore,
          reason: message,
          riskLevel: pending.riskLevel,
          riskScore: pending.riskScore,
        },
      )],
      pendingRiskChange: null,
      riskReviewStatus: request.status,
    };
    replaceStored(store, next);
    return toState(next);
  },
};
