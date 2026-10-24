import type { StatusChipStatus } from '../../shared/components/ui';
import type { AdminAction, EscalationStatus, RiskLevel } from '../../shared/types';

export const escalationStatusLabel: Record<EscalationStatus, string> = {
  NOT_SHARED: '공유 전',
  SHARED: '확인 대기',
  UNDER_REVIEW: '검토 중',
  COMPLETED: '처리 완료',
  RETURNED_TO_TEACHER: '교사 반환',
};

export const escalationStatusChip: Record<EscalationStatus, StatusChipStatus> = {
  NOT_SHARED: 'default',
  SHARED: 'pending',
  UNDER_REVIEW: 'progress',
  COMPLETED: 'complete',
  RETURNED_TO_TEACHER: 'review',
};

// Teacher-facing wording: the teacher waits on the admin rather than acting.
export const teacherEscalationStatusLabel: Record<EscalationStatus, string> = {
  NOT_SHARED: '공유 전',
  SHARED: '관리자 확인 대기',
  UNDER_REVIEW: '관리자 검토 중',
  COMPLETED: '관리자 처리 완료',
  RETURNED_TO_TEACHER: '교사에게 반환됨',
};

// Matches the teacher inbox tone (low → 일반, emergency → 긴급).
export const apiRiskTone = {
  LOW: 'normal',
  MEDIUM: 'attention',
  HIGH: 'danger',
  EMERGENCY: 'urgent',
} as const satisfies Record<RiskLevel, string>;

export const riskLevelOrder: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'];

// Each admin action moves one step; anything else is rejected with 409.
export const adminActionTransition: Record<AdminAction, { from: EscalationStatus; to: EscalationStatus }> = {
  START_REVIEW: { from: 'SHARED', to: 'UNDER_REVIEW' },
  REVIEW_COMPLETE: { from: 'UNDER_REVIEW', to: 'COMPLETED' },
};

export function getNextAdminAction(status: EscalationStatus): AdminAction | null {
  const entry = (Object.entries(adminActionTransition) as [AdminAction, { from: EscalationStatus }][])
    .find(([, transition]) => transition.from === status);
  return entry?.[0] ?? null;
}

export const SHARE_REASON_MAX_LENGTH = 500;
export const ADMIN_MEMO_MAX_LENGTH = 500;

export function formatEscalationTime(value: string | null | undefined) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
