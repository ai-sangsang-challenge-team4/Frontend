import type {
  EscalationScope,
  EscalationStatus,
  HistoryEventType,
  ComplaintStatus,
  EmergencyReviewDecision,
  MessageSenderRole,
  MessageStatus,
  RiskFactorStatus,
  RiskLevel,
  RiskReviewDirection,
  RiskReviewStatus,
} from '../../shared/types';

// Shapes in this file follow the backend DTOs (escalation/dto, risk/dto, complaint/teacher/dto).
// Where /v3/api-docs and the code disagree, the code wins. Do not add fields the backend does not define.
// Dates are LocalDateTime strings without a time zone (e.g. 2026-10-28T12:18:23.227).

// Thread IDs are strings in the mock inbox; the server only knows numeric complaintId.
export type ComplaintId = number | string;

// GET /teacher/complaints/{complaintId}/escalation and every admin action response.
export type EscalationStateResponse = {
  // null while NOT_SHARED.
  escalationId: number | null;
  // The latest emergency review request, or null when none was made.
  emergencyReviewRequestId: number | null;
  escalationStatus: EscalationStatus;
  // Status of that emergency review request; null when none was made.
  riskReviewStatus: RiskReviewStatus | null;
  // null only when the complaint has no completed analysis (NOT_SHARED).
  currentRiskScore: number | null;
  currentRiskLevel: RiskLevel | null;
  // True while the emergency policy holds, even after the reviewer applied a lower score.
  safetyLock: boolean;
};

// POST /teacher/complaints/{complaintId}/escalation (201, body is a plain string)
export type ShareEscalationRequest = {
  // null lets the server assign the first admin.
  adminId: number | null;
  reason: string;
  scopes: EscalationScope[];
};

// POST /teacher/complaints/{complaintId}/risk-reviews
export type TeacherRiskReviewRequest = {
  riskScore: number;
  // Required when lowering.
  reason: string | null;
};

// @JsonInclude(NON_NULL): a review applied right away has riskReviewId; lowering an EMERGENCY score
// instead opens an emergency review and returns emergencyReviewRequestId with PENDING_ADMIN_APPROVAL.
export type TeacherRiskReviewResponse = {
  riskReviewId?: number;
  emergencyReviewRequestId?: number;
  complaintId: number;
  riskAnalysisId: number;
  previousScore: number;
  previousLevel: RiskLevel;
  riskScore: number;
  riskLevel: RiskLevel;
  direction: RiskReviewDirection;
  // Omitted when no reason was given.
  reason?: string;
  reviewedBy: string;
  reviewedAt: string;
  status: RiskReviewStatus;
  safetyLock: boolean;
};

// GET /admin/escalations, GET /admin/escalations/{escalationId}
export type AdminEscalationSummaryResponse = {
  escalationId: number;
  // The complaint's latest emergency review request, or null when none was made.
  emergencyReviewRequestId: number | null;
  complaintId: number;
  sharedBy: string;
  reason: string;
  currentRiskLevel: RiskLevel;
  escalationStatus: EscalationStatus;
  riskReviewStatus: RiskReviewStatus | null;
  safetyLock: boolean;
  sharedAt: string;
};

export type AdminEscalationListQuery = {
  status?: EscalationStatus;
  riskLevel?: RiskLevel;
};

// POST /admin/escalations/{escalationId}/review, /complete
export type EscalationMessageRequest = {
  message: string;
};

// POST /teacher/complaints/{complaintId}/emergency-review (201)
export type EmergencyReviewCreateRequest = {
  // 1~6, below the current EMERGENCY score.
  riskScore: number;
  // Required, up to 300 characters.
  reason: string;
  // Omitted: the shared admin, or else the first admin.
  reviewerId?: number;
};

// PATCH /admin/emergency-review/{requestId}. status or safetyLock is required.
// Applying does not lift the lock; that takes { safetyLock: false }.
export type EmergencyReviewUpdateRequest = {
  status?: EmergencyReviewDecision;
  safetyLock?: boolean;
  // Optional, up to 500 characters.
  message?: string;
};

// Every emergency review endpoint.
export type EmergencyReviewResponse = {
  requestId: number;
  complaintId: number;
  riskAnalysisId: number;
  previousRiskScore: number;
  previousRiskLevel: RiskLevel;
  requestedRiskScore: number;
  requestedRiskLevel: RiskLevel;
  reason: string;
  status: RiskReviewStatus;
  safetyLock: boolean;
  reviewerId: number;
  reviewerName: string;
  requestedAt: string;
  decidedAt: string | null;
  safetyLockUpdatedAt: string | null;
};

export type ConversationMessage = {
  messageId: string;
  senderRole: MessageSenderRole;
  senderName: string;
  content: string;
  // Optional for servers still returning the earlier conversation DTO.
  status?: MessageStatus;
  sentAt: string;
  readAt?: string | null;
  summarized: boolean;
};

// GET /admin/escalations/{escalationId}/messages
export type EscalationShareContentResponse = {
  reason: string;
  maskedMessages: ConversationMessage[];
  originalMessages: ConversationMessage[];
  mediationPackageIncluded: boolean;
};

export type DetectedFactorCode =
  | 'PROFANITY'
  | 'INSULT'
  | 'THREAT'
  | 'LEGAL'
  | 'EXPOSURE'
  | 'REPEAT'
  | 'UNFAIR_REQUEST'
  | 'PRIVACY';

export type DetectedFactor = {
  code: DetectedFactorCode;
  name: string;
  state?: RiskFactorStatus;
  evidenceSpans?: { text: string; start?: number | null; end?: number | null }[];
  // Earlier servers return detected factors only, with a single evidence string.
  evidence?: string;
  reason: string;
};

export type LatestReview = {
  riskReviewId: number;
  direction: RiskReviewDirection;
  reason: string;
  reviewedBy: string;
  reviewedAt: string;
};

// GET /admin/escalations/{escalationId}/risk
export type TeacherRiskResponse = {
  complaintId: number;
  riskAnalysisId: number;
  riskScore: number;
  riskLevel: RiskLevel;
  // The server always fills these: the latest review, or the initial score for the analysed level.
  reviewScore: number;
  reviewLevel: RiskLevel;
  safetyLock: boolean;
  analyzedAt: string;
  latestReview: LatestReview | null;
  detectedFactors: DetectedFactor[];
};

// @JsonInclude(NON_NULL): empty fields are omitted, not null. Compare with == null.
export type HistoryEvent = {
  eventId: string;
  type: HistoryEventType;
  occurredAt: string;
  actorName?: string | null;
  referenceType?: string | null;
  referenceId?: number | null;
  previousStatus?: ComplaintStatus | null;
  newStatus?: ComplaintStatus | null;
  riskScore?: number | null;
  riskLevel?: RiskLevel | null;
  previousRiskScore?: number | null;
  previousRiskLevel?: RiskLevel | null;
  reason?: string | null;
};

// GET /admin/escalations/{escalationId}/history
export type TeacherHistoryResponse = {
  complaintId: number;
  // Omitted by earlier servers. Absence does not certify that the logs are complete.
  logComplete?: boolean;
  missingLogs?: {
    expectedType: HistoryEventType;
    referenceType?: string | null;
    referenceId?: number | null;
    description: string;
  }[];
  events: HistoryEvent[];
};

// ---- Mock only: no endpoint in the spec ----

// "My shared complaints" list on /teacher/admin-share. The backend has no endpoint for it yet.
export type MockTeacherEscalation = {
  complaintId: ComplaintId;
  escalationId: number;
  escalationStatus: EscalationStatus;
  sharedAt: string;
  title: string;
};

// What the mock server would already know about a complaint. The HTTP adapter never sends it.
export type EscalationComplaintSnapshot = {
  detectedFactors: DetectedFactor[];
  maskedMessages: ConversationMessage[];
  originalMessages: ConversationMessage[];
  riskLevel: RiskLevel;
  riskScore: number;
  title: string;
};
