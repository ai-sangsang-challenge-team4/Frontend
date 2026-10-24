import { ApiError } from '../../../shared/api';
import type { EscalationStatus, UserRole } from '../../../shared/types';
import { readAuthSession } from '../../auth/api/authStorage';
import { ADMIN_MEMO_MAX_LENGTH, adminActionTransition, SHARE_REASON_MAX_LENGTH } from '../escalationRules';
import type {
  AdminComplaintDetail,
  AdminComplaintListItem,
  AdminRecipient,
  ComplaintEscalation,
  EscalationComplaintSnapshot,
  EscalationHistoryItem,
} from '../escalationTypes';
import { ESCALATIONS_CHANGED_EVENT, type EscalationApi } from './escalationApiContract';

const STORAGE_KEY = 'teacher-hub.escalations';
const MOCK_DELAY_MS = 300;

// Matches the ADMIN account in mockAuthApi.
const ADMIN_RECIPIENTS: AdminRecipient[] = [
  { userId: 301, name: '관리자 사용자', role: '학교 관리자' },
];

type StoredEscalation = {
  adminMemo: string | null;
  assignedAdminId: number;
  assignedAdminName: string;
  complaintId: string;
  escalationId: number;
  evidencePackageAttached: boolean;
  history: EscalationHistoryItem[];
  processedAt: string | null;
  reason: string;
  shareMaskedContent: boolean;
  shareOriginalContent: boolean;
  sharedAt: string;
  sharedBy: number;
  snapshot: EscalationComplaintSnapshot;
  status: EscalationStatus;
};

function readStore(): StoredEscalation[] {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeStore(items: StoredEscalation[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    throw new ApiError({ status: 503, message: '공유 정보를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.' });
  }
  window.dispatchEvent(new Event(ESCALATIONS_CHANGED_EVENT));
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
  if (user.role !== role) {
    throw new ApiError({
      status: 403,
      code: role === 'ADMIN' ? 'ADMIN_ACCESS_DENIED' : 'ESCALATION_FORBIDDEN',
    });
  }
  return user;
}

function toTeacherView(item: StoredEscalation): ComplaintEscalation {
  return {
    adminMemo: item.adminMemo,
    assignedAdminName: item.assignedAdminName,
    complaintId: item.complaintId,
    escalationId: item.escalationId,
    processedAt: item.processedAt,
    reason: item.reason,
    sharedAt: item.sharedAt,
    status: item.status,
    title: item.snapshot.title,
  };
}

function toListItem(item: StoredEscalation): AdminComplaintListItem {
  return {
    complaintId: item.complaintId,
    escalationStatus: item.status,
    reason: item.reason,
    riskLevel: item.snapshot.riskLevel,
    sharedAt: item.sharedAt,
    studentName: item.snapshot.studentName,
    teacherName: item.snapshot.teacherName,
    title: item.snapshot.title,
  };
}

// Only the content the teacher opted to share leaves the server.
function toAdminDetail(item: StoredEscalation): AdminComplaintDetail {
  const { snapshot } = item;
  const isHighRisk = snapshot.riskLevel === 'HIGH' || snapshot.riskLevel === 'EMERGENCY';
  return {
    ...toListItem(item),
    adminMemo: item.adminMemo,
    bufferedSummary: snapshot.bufferedSummary,
    className: snapshot.className,
    escalationId: item.escalationId,
    evidencePackageAttached: item.evidencePackageAttached,
    history: item.history,
    maskedContent: item.shareMaskedContent ? snapshot.maskedContent : null,
    originalContent: item.shareOriginalContent ? snapshot.originalContent : null,
    parentName: snapshot.parentName,
    processedAt: item.processedAt,
    recommendedActions: isHighRisk
      ? ['원문과 판정 근거 확인', '증빙 자료 보존', '담당 교사와 대응 방향 협의']
      : ['판정 근거 확인', '담당 교사와 대응 방향 협의'],
    riskFactors: snapshot.riskFactors,
    shareMaskedContent: item.shareMaskedContent,
    shareOriginalContent: item.shareOriginalContent,
  };
}

function findAssigned(complaintId: string | number, adminId: number) {
  return readStore().find((item) => item.complaintId === String(complaintId) && item.assignedAdminId === adminId);
}

export const mockEscalationApi: EscalationApi = {
  async getAdminRecipients(signal) {
    await wait(signal);
    requireUser('TEACHER');
    return ADMIN_RECIPIENTS;
  },

  async createEscalation(complaintId, request, options) {
    await wait(options?.signal);
    const teacher = requireUser('TEACHER');
    const reason = request.reason.trim();
    if (!reason || reason.length > SHARE_REASON_MAX_LENGTH) {
      throw new ApiError({ status: 400, code: 'INVALID_ESCALATION_REASON' });
    }
    if (!request.shareMaskedContent && !request.shareOriginalContent) {
      throw new ApiError({ status: 400, code: 'ESCALATION_CONTENT_REQUIRED' });
    }
    const admin = ADMIN_RECIPIENTS.find((item) => item.userId === request.assignedAdminId);
    if (!admin) throw new ApiError({ status: 404, code: 'ADMIN_NOT_FOUND' });
    if (!options?.snapshot) throw new ApiError({ status: 404, code: 'COMPLAINT_NOT_FOUND' });

    const store = readStore();
    if (store.some((item) => item.complaintId === String(complaintId) && item.status !== 'RETURNED_TO_TEACHER')) {
      throw new ApiError({ status: 409, code: 'ALREADY_ESCALATED' });
    }

    const sharedAt = new Date().toISOString();
    const created: StoredEscalation = {
      adminMemo: null,
      assignedAdminId: admin.userId,
      assignedAdminName: admin.name,
      complaintId: String(complaintId),
      escalationId: Math.max(1100, ...store.map((item) => item.escalationId)) + 1,
      evidencePackageAttached: Boolean(request.evidencePackageId),
      history: [{
        changedAt: sharedAt,
        changedBy: teacher.name,
        newStatus: 'SHARED',
        previousStatus: 'NOT_SHARED',
      }],
      processedAt: null,
      reason,
      shareMaskedContent: request.shareMaskedContent,
      shareOriginalContent: request.shareOriginalContent,
      sharedAt,
      sharedBy: teacher.userId,
      snapshot: { ...options.snapshot, teacherName: teacher.name },
      status: 'SHARED',
    };
    writeStore([...store, created]);

    return {
      assignedAdminId: admin.userId,
      complaintId,
      escalationId: created.escalationId,
      sharedAt,
      sharedBy: teacher.userId,
      status: created.status,
    };
  },

  async getComplaintEscalation(complaintId, signal) {
    await wait(signal);
    const teacher = requireUser('TEACHER');
    const item = readStore()
      .filter((entry) => entry.complaintId === String(complaintId) && entry.sharedBy === teacher.userId)
      .at(-1);
    return item ? toTeacherView(item) : null;
  },

  async listMyEscalations(signal) {
    await wait(signal);
    const teacher = requireUser('TEACHER');
    return readStore()
      .filter((item) => item.sharedBy === teacher.userId)
      .sort((left, right) => right.sharedAt.localeCompare(left.sharedAt))
      .map(toTeacherView);
  },

  async listAdminComplaints(query = {}, signal) {
    await wait(signal);
    const admin = requireUser('ADMIN');
    const { escalationStatus, page = 0, riskLevel, size = 20 } = query;
    const items = readStore()
      .filter((item) => item.assignedAdminId === admin.userId)
      .filter((item) => !escalationStatus || item.status === escalationStatus)
      .filter((item) => !riskLevel || item.snapshot.riskLevel === riskLevel)
      .sort((left, right) => right.sharedAt.localeCompare(left.sharedAt))
      .map(toListItem);
    return { items: items.slice(page * size, (page + 1) * size), page, size, totalElements: items.length };
  },

  async getAdminComplaint(complaintId, signal) {
    await wait(signal);
    const admin = requireUser('ADMIN');
    const item = findAssigned(complaintId, admin.userId);
    // An unshared complaint, or one shared with another admin, is never readable here.
    if (!item) throw new ApiError({ status: 403, code: 'COMPLAINT_NOT_SHARED' });
    return toAdminDetail(item);
  },

  async processAdminComplaint(complaintId, request, signal) {
    await wait(signal);
    const admin = requireUser('ADMIN');
    const store = readStore();
    const item = store.find((entry) => entry.complaintId === String(complaintId) && entry.assignedAdminId === admin.userId);
    if (!item) throw new ApiError({ status: 404, code: 'ESCALATION_NOT_FOUND' });

    const transition = adminActionTransition[request.action];
    if (!transition) throw new ApiError({ status: 400, code: 'INVALID_ADMIN_ACTION' });
    if (item.status !== transition.from) throw new ApiError({ status: 409, code: 'INVALID_ESCALATION_TRANSITION' });
    const memo = request.memo?.trim() ?? '';
    if (memo.length > ADMIN_MEMO_MAX_LENGTH) throw new ApiError({ status: 400, code: 'INVALID_ADMIN_ACTION' });

    const processedAt = new Date().toISOString();
    const next: StoredEscalation = {
      ...item,
      adminMemo: memo || item.adminMemo,
      history: [...item.history, {
        changedAt: processedAt,
        changedBy: admin.name,
        memo: memo || undefined,
        newStatus: transition.to,
        previousStatus: item.status,
      }],
      processedAt,
      status: transition.to,
    };
    writeStore(store.map((entry) => entry === item ? next : entry));

    return {
      adminAction: request.action,
      complaintId,
      escalationStatus: next.status,
      processedAt,
      processedBy: admin.userId,
    };
  },
};
