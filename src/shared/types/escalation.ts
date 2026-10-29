// Enums below mirror the backend OpenAPI spec (/v3/api-docs). Use them as-is; do not map to other values.

// Admin sharing state (EscalationStateResponse.escalationStatus).
export type EscalationStatus = 'NOT_SHARED' | 'SHARED' | 'UNDER_REVIEW' | 'COMPLETED';

// Emergency review request state, independent of EscalationStatus
// (EmergencyReviewResponse.status, EscalationStateResponse.riskReviewStatus, TeacherRiskReviewResponse.status).
export type RiskReviewStatus = 'PENDING_ADMIN_APPROVAL' | 'APPLIED' | 'REJECTED';

// EmergencyReviewUpdateRequest.status: the reviewer cannot set PENDING_ADMIN_APPROVAL.
export type EmergencyReviewDecision = Extract<RiskReviewStatus, 'APPLIED' | 'REJECTED'>;

export type RiskReviewDirection = 'LOWERED' | 'UNCHANGED' | 'RAISED';

// ShareEscalationRequest.scopes. MASKING_MESSAGES is always included.
export type EscalationScope = 'MASKING_MESSAGES' | 'ORIGINAL_MESSAGES' | 'MEDIATION_PACKAGE';

// HistoryEvent.type. ESCALATION_RISK_CHANGE_* are deprecated on the backend but kept for past events.
export type HistoryEventType =
  | 'STATUS_CHANGED'
  | 'RISK_ANALYZED'
  | 'RISK_REVIEWED'
  | 'ORIGINAL_VIEWED'
  | 'AI_DRAFT_GENERATED'
  | 'MESSAGE_SENT'
  | 'ESCALATION_SHARED'
  | 'ESCALATION_REVIEW_STARTED'
  | 'ESCALATION_RISK_CHANGE_REQUESTED'
  | 'ESCALATION_RISK_CHANGE_APPROVED'
  | 'ESCALATION_RISK_CHANGE_REJECTED'
  | 'ESCALATION_COMPLETED'
  | 'EMERGENCY_REVIEW_REQUESTED'
  | 'EMERGENCY_REVIEW_APPROVED'
  | 'EMERGENCY_REVIEW_REJECTED'
  | 'EMERGENCY_SAFETY_LOCK_UPDATED';
