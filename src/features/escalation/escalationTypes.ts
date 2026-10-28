import type {
  EscalationScope,
  EscalationStatus,
  HistoryEventType,
  ComplaintStatus,
  MessageSenderRole,
  RiskChangeDecision,
  RiskLevel,
  RiskReviewDirection,
  RiskReviewStatus,
} from '../../shared/types';

// Shapes in this file follow the backend OpenAPI spec (/v3/api-docs).
// Do not add fields the spec does not define.

// Thread IDs are strings in the mock inbox; the server only knows numeric complaintId.
export type ComplaintId = number | string;

// GET /teacher/complaints/{complaintId}/escalation and every admin action response.
export type EscalationStateResponse = {
  // TODO(backend): nullability is not stated in the spec; assumed null while NOT_SHARED.
  escalationId: number | null;
  escalationStatus: EscalationStatus;
  // TODO(backend): nullability is not stated in the spec; assumed null when no risk change was requested.
  riskReviewStatus: RiskReviewStatus | null;
  currentRiskScore: number;
  currentRiskLevel: RiskLevel;
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

export type TeacherRiskReviewResponse = {
  riskReviewId: number;
  complaintId: number;
  riskAnalysisId: number;
  previousScore: number;
  previousLevel: RiskLevel;
  riskScore: number;
  riskLevel: RiskLevel;
  direction: RiskReviewDirection;
  reason: string;
  reviewedBy: string;
  reviewedAt: string;
  status: RiskReviewStatus;
};

// GET /admin/escalations, GET /admin/escalations/{escalationId}
// TODO(backend): riskReviewStatus is missing, so the admin screen cannot tell a pending risk change on load.
export type AdminEscalationSummaryResponse = {
  escalationId: number;
  complaintId: number;
  sharedBy: string;
  reason: string;
  currentRiskLevel: RiskLevel;
  escalationStatus: EscalationStatus;
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

// POST /admin/escalations/{escalationId}/risk-change-decision
export type RiskChangeDecisionRequest = {
  status: RiskChangeDecision;
  message: string;
};

export type ConversationMessage = {
  messageId: string;
  senderRole: MessageSenderRole;
  senderName: string;
  content: string;
  sentAt: string;
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
  evidence: string;
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
  reviewScore: number | null;
  reviewLevel: RiskLevel | null;
  analyzedAt: string;
  latestReview: LatestReview | null;
  detectedFactors: DetectedFactor[];
};

export type HistoryEvent = {
  eventId: string;
  type: HistoryEventType;
  occurredAt: string;
  actorName: string;
  previousStatus: ComplaintStatus | null;
  newStatus: ComplaintStatus | null;
  riskScore: number | null;
  riskLevel: RiskLevel | null;
  previousRiskScore: number | null;
  previousRiskLevel: RiskLevel | null;
  reason: string | null;
};

// GET /admin/escalations/{escalationId}/history
export type TeacherHistoryResponse = {
  complaintId: number;
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
