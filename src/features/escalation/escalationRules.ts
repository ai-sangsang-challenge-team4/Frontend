import type { StatusChipStatus } from '../../shared/components/ui';
import { toServerInstant } from '../../shared/api';
import type { EscalationStatus, HistoryEventType, RiskFactorStatus, RiskLevel, RiskReviewStatus } from '../../shared/types';
import { formatServerMaskedText } from '../pii/masking';
import type { DetectedFactor } from './escalationTypes';

export function getDetectedFactorState(factor: DetectedFactor): RiskFactorStatus {
  // The old DTO contains only detected factors and has no state field.
  if (factor.state === undefined) return 'PRESENT';
  switch (factor.state) {
    case 'PRESENT': case 'ABSENT': case 'BOUNDARY': case 'UNKNOWN': return factor.state;
    default: return 'UNKNOWN';
  }
}

export function getDetectedFactorEvidence(factor: DetectedFactor): string[] {
  // An explicitly empty span list must not revive an older evidence string.
  const evidence = factor.evidenceSpans?.map((span) => span.text) ?? (factor.evidence ? [factor.evidence] : []);
  return evidence.filter((text) => text.trim()).map(formatServerMaskedText);
}

export const escalationStatusLabel: Record<EscalationStatus, string> = {
  NOT_SHARED: '공유 전',
  SHARED: '확인 대기',
  UNDER_REVIEW: '검토 중',
  COMPLETED: '처리 완료',
};

export const escalationStatusChip: Record<EscalationStatus, StatusChipStatus> = {
  NOT_SHARED: 'default',
  SHARED: 'pending',
  UNDER_REVIEW: 'progress',
  COMPLETED: 'complete',
};

// Teacher-facing wording: the teacher waits on the admin rather than acting.
export const teacherEscalationStatusLabel: Record<EscalationStatus, string> = {
  NOT_SHARED: '공유 전',
  SHARED: '관리자 확인 대기',
  UNDER_REVIEW: '관리자 검토 중',
  COMPLETED: '관리자 처리 완료',
};

export const riskReviewStatusLabel: Record<RiskReviewStatus, string> = {
  PENDING_ADMIN_APPROVAL: '관리자 승인 대기',
  APPLIED: '반영됨',
  REJECTED: '반려됨',
};

export const riskReviewStatusChip: Record<RiskReviewStatus, StatusChipStatus> = {
  PENDING_ADMIN_APPROVAL: 'pending',
  APPLIED: 'complete',
  REJECTED: 'review',
};

export const historyEventLabel: Record<HistoryEventType, string> = {
  MEDIATION_PACKAGE_CREATED: '증빙 패키지 생성',
  STATUS_CHANGED: '민원 상태 변경',
  RISK_ANALYZED: '위험 분석',
  AI_ANALYSIS_SKIPPED: 'AI 분석 생략',
  AI_ANALYSIS_RULE_FALLBACK: '규칙 기반 잠정 분석',
  RISK_REVIEWED: '교사 위험도 검토',
  ORIGINAL_VIEWED: '원문 열람',
  AI_DRAFT_GENERATED: 'AI 답변 초안 생성',
  AI_DRAFT_BLOCKED_BY_RISK_POLICY: '위험도 정책으로 AI 초안 생성 차단',
  RESPONSE_BLOCKED_BY_RISK_POLICY: '위험도 정책으로 답변 차단',
  RESPONSE_BLOCKED_BY_SAFETY_LOCK: '안전 잠금으로 답변 차단',
  RESPONSE_TEMPLATE_ADOPTED: '답변 템플릿 채택',
  MESSAGE_SENT: '메시지 전송',
  MESSAGE_READ: '메시지 읽음',
  ESCALATION_SHARED: '관리자 공유',
  ESCALATION_REVIEW_STARTED: '관리자 검토 시작',
  // Deprecated on the backend; only past events carry these.
  ESCALATION_RISK_CHANGE_REQUESTED: '위험도 변경 승인 요청',
  ESCALATION_RISK_CHANGE_APPROVED: '위험도 변경 승인',
  ESCALATION_RISK_CHANGE_REJECTED: '위험도 변경 거부',
  ESCALATION_COMPLETED: '관리자 검토 완료',
  EMERGENCY_REVIEW_REQUESTED: '긴급 위험도 재검토 요청',
  EMERGENCY_REVIEW_APPROVED: '긴급 위험도 재검토 승인',
  EMERGENCY_REVIEW_REJECTED: '긴급 위험도 재검토 거부',
  EMERGENCY_SAFETY_LOCK_UPDATED: '안전 잠금 변경',
};

// Matches the teacher inbox tone (low → 일반, emergency → 긴급).
export const apiRiskTone = {
  LOW: 'normal',
  MEDIUM: 'attention',
  HIGH: 'danger',
  EMERGENCY: 'urgent',
} as const satisfies Record<RiskLevel, string>;

// Only convert a known teacher review score (choice ×10) back to its 1~7 scale.
// System scores are 0~100 and must be displayed directly, without this conversion.
export function toDisplayRiskScore(score: number) {
  return Math.min(7, Math.max(1, Math.ceil(score / 10)));
}

export const riskLevelOrder: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'];

// Only EMERGENCY can be shared (other levels get 409).
// TODO(policy): whether HIGH should also be shareable is undecided.
export const SHAREABLE_RISK_LEVEL: RiskLevel = 'EMERGENCY';

// Button visibility only pre-empts obvious 409s; the backend makes the final call.
export function canStartEscalationReview(status: EscalationStatus) {
  return status === 'SHARED';
}

// The server completes only UNDER_REVIEW, and answers 409 ESCALATION_STATE_INVALID
// while the complaint's latest emergency review is still pending.
export function canCompleteEscalation(status: EscalationStatus, riskReviewStatus: RiskReviewStatus | null) {
  return status === 'UNDER_REVIEW' && riskReviewStatus !== 'PENDING_ADMIN_APPROVAL';
}

// A decision is made on the emergency review request itself, whatever the share's status.
export function canDecideEmergencyReview(requestId: number | null, riskReviewStatus: RiskReviewStatus | null) {
  return requestId !== null && riskReviewStatus === 'PENDING_ADMIN_APPROVAL';
}

// Current approvals release the lock. Keep a manual fallback only for an approved response
// that explicitly still reports a lock (e.g. an older server record).
export function canReleaseSafetyLock(
  requestId: number | null,
  riskReviewStatus: RiskReviewStatus | null,
  safetyLock: boolean,
) {
  return requestId !== null && safetyLock && riskReviewStatus === 'APPLIED';
}

// Only a pending request blocks another request. A rejected request may retain its safety lock.
export function canRequestEmergencyReview(riskReviewStatus: RiskReviewStatus | null) {
  return riskReviewStatus !== 'PENDING_ADMIN_APPROVAL';
}

export const SHARE_REASON_MAX_LENGTH = 500;
export const ADMIN_MESSAGE_MAX_LENGTH = 500;
export const RISK_REVIEW_REASON_MAX_LENGTH = 300;

export function formatEscalationTime(value: string | null | undefined) {
  if (!value) return '-';
  const date = new Date(toServerInstant(value));
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
