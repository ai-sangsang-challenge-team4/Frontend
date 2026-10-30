import type { ComplaintStatus, MessageStatus, RiskFactorStatus, RiskLevel, WaitingFor } from '../../../shared/types';
import type { DetectedFactorCode } from '../../escalation/escalationTypes';
import type { ComplaintListQuery, ComplaintPageResponse } from '../../message/api/teacherInboxTypes';

// Shapes in this file follow the backend parent complaint and risk analysis DTOs
// (complaint/parent/dto/complaint, risk/dto/response). Do not add fields the backend does not define.
// The parent flow: POST /complaints (DRAFT) → POST /risk-analysis → GET /findings → PATCH if edited → POST /send.

// POST /complaints. title @NotBlank @Size(max = 100), content @NotBlank (no server length limit).
// The parent must be linked to the student, and the teacher must be assigned to the student's latest class
// (else 400 INVALID_COMPLAINT_RECIPIENT).
export type ComplaintCreateRequest = {
  studentId: number;
  teacherId: number;
  title: string;
  content: string;
};

export const COMPLAINT_TITLE_MAX_LENGTH = 100;

// POST /complaints (201) and GET /complaints/{id}/status.
export type ComplaintResponse = {
  complaintId: number;
  status: ComplaintStatus;
  waitingFor: WaitingFor;
};

// PATCH /complaints/{id}. Only the content of a DRAFT; the title cannot change after creation.
export type ComplaintDraftUpdateRequest = {
  content: string;
};

// PATCH /complaints/{id} and POST /complaints/{id}/send answer { message } instead of a DTO.
export type ComplaintMessageResponse = {
  message: string;
};

// GET /complaints/recipients?studentId=. Teachers assigned to the student's latest class,
// homeroom teacher first. An empty list means the student has no class.
export type ComplaintRecipientResponse = {
  teacherId: number;
  teacherName: string;
  homeroomTeacher: boolean;
};

// GET /complaints: the same query and page shape as the teacher list, but the parent's own DRAFT complaints
// are listed too. counterpartName is the teacher, latestReceivedAt is the parent's latest sent message, and
// aiSummary summarises that message.
export type ParentComplaintListQuery = ComplaintListQuery;
export type ParentComplaintPageResponse = ComplaintPageResponse;

// GET /complaints/{id}. content is the initial inquiry; follow-ups and replies come from /messages.
export type ParentComplaintDetailResponse = {
  complaintId: number;
  title: string;
  studentId: number;
  studentName: string;
  parentName: string;
  teacherName: string;
  content: string;
  status: ComplaintStatus;
  waitingFor: WaitingFor;
  riskLevel: RiskLevel | null;
  createdAt: string;
  updatedAt: string;
};

// POST /complaints/{id}/risk-analysis. Only the score; evidence and suggestions come from /findings.
// One analysis per message: the same content returns the existing analysis, and different content after an
// analysis answers 409 FINAL_ANALYSIS_ON_SUBMIT (the server analyzes it again on /send instead).
export type RiskSummaryResponse = {
  analysisId: number;
  complaintId: number;
  riskScore: number;
  riskLevel: RiskLevel;
};

export type RiskRevisionSuggestion = {
  originalExpression: string;
  suggestedExpression: string;
  reason: string;
};

// Detected tags only. Evidence and suggestions are masked by the server.
export type RiskFinding = {
  code: DetectedFactorCode;
  evidences: string[];
  revisionSuggestions: RiskRevisionSuggestion[];
};

// GET /risk-analyses/{analysisId}/findings. finalRevision is null when no revision was generated
// (an analysis made on /send).
export type RiskRevisionResponse = {
  findings: RiskFinding[];
  finalRevision: { reason: string | null; content: string } | null;
};

export type ComplaintMaskResponse = {
  complaintId: number;
  contentVersion: number;
  maskedContent: string;
};

export type RiskDetection = {
  state?: RiskFactorStatus;
  confidence: number | null;
  evidenceSpans?: { text: string; start?: number | null; end?: number | null }[];
  // Older deployed servers use boolean flags and plain evidence strings.
  detected?: boolean;
  evidences?: string[];
};

export type RiskDetectorResponse = {
  analysisId: number;
  results: {
    code: DetectedFactorCode;
    finalState?: RiskFactorStatus;
    finalDetected?: boolean;
    rule: RiskDetection | null;
    llm: RiskDetection | null;
  }[];
  llm: { modelName: string; temperature: number | null } | null;
};

// PUT /complaints/{id}/message-draft. expectedContentVersion is required once a draft exists and omitted
// for the first save; a mismatch answers 409 CONTENT_VERSION_CONFLICT without saving.
export type ParentFollowUpDraftRequest = {
  content: string;
  expectedContentVersion?: number;
};

// POST /complaints/{id}/messages/{messageId}/send. A missing or stale version answers 409
// CONTENT_VERSION_CONFLICT without sending.
export type ParentFollowUpSendRequest = {
  expectedContentVersion: number;
};

export type ParentFollowUpResponse = {
  messageId: number;
  complaintId: number;
  content: string;
  status: MessageStatus;
  waitingFor: WaitingFor;
  contentVersion: number;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
};

// GET /complaints/{id}/messages (Swagger ParentConversationMessage).
export type ParentConversationResponse = {
  complaintId: number;
  status: ComplaintStatus;
  waitingFor: WaitingFor;
  messages: {
    messageId: number;
    type: 'PARENT_INQUIRY' | 'TEACHER_REPLY';
    senderRole: 'PARENT' | 'TEACHER';
    senderName: string;
    content: string;
    status: MessageStatus;
    sentAt: string | null;
    readAt: string | null;
  }[];
};
