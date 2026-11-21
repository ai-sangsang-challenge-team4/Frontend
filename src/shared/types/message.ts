// Enums below mirror the backend OpenAPI spec (/v3/api-docs).

// Single message state (ParentMessageResponse.status).
export type MessageStatus = 'DRAFT' | 'SENT' | 'READ';

export type MessageSummaryStatus = 'GENERATED' | 'UNAVAILABLE';

// Complaint (conversation) state. Admin sharing lives in EscalationStatus, not here.
export type ComplaintStatus = 'DRAFT' | 'OPEN' | 'ANSWERED' | 'CLOSED';

// Whose turn it is to reply.
export type WaitingFor = 'PARENT' | 'TEACHER' | 'NONE';

// TeacherConversationResponse.allowedActions
export type TeacherAllowedAction =
  | 'USE_RESPONSE_TEMPLATE'
  | 'CREATE_EVIDENCE_PACKAGE'
  | 'REQUEST_ADMIN_REVIEW'
  | 'VIEW_OFFICIAL_PROCEDURE'
  | 'REQUEST_MANUAL_REVIEW';

export type MessageSenderRole = 'PARENT' | 'TEACHER' | 'ADMIN';

export type ComplaintType =
  | 'GENERAL_INQUIRY'
  | 'COUNSELING_REQUEST'
  | 'COMPLAINT'
  | 'EVALUATION_OBJECTION'
  | 'STUDENT_GUIDANCE'
  | 'OTHER';

export type GenerationMode =
  | 'RAG_GENERATED'
  | 'APPROVED_TEMPLATE'
  | 'PROCEDURE_ONLY'
  | 'BLOCKED_NO_EVIDENCE';
