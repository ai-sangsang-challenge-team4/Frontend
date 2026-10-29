import type {
  AdminEscalationListQuery,
  AdminEscalationSummaryResponse,
  ComplaintId,
  EmergencyReviewCreateRequest,
  EmergencyReviewResponse,
  EmergencyReviewUpdateRequest,
  EscalationComplaintSnapshot,
  EscalationMessageRequest,
  EscalationShareContentResponse,
  EscalationStateResponse,
  MockTeacherEscalation,
  ShareEscalationRequest,
  TeacherHistoryResponse,
  TeacherRiskResponse,
  TeacherRiskReviewRequest,
  TeacherRiskReviewResponse,
} from '../escalationTypes';

export type TeacherRequestOptions = {
  signal?: AbortSignal;
  // Mock only: the complaint data a real server already has. The HTTP adapter ignores it.
  snapshot?: EscalationComplaintSnapshot;
};

export type EscalationApi = {
  // Teacher
  getEscalationState: (complaintId: ComplaintId, options?: TeacherRequestOptions) => Promise<EscalationStateResponse>;
  shareEscalation: (
    complaintId: ComplaintId,
    request: ShareEscalationRequest,
    options?: TeacherRequestOptions,
  ) => Promise<void>;
  submitRiskReview: (
    complaintId: ComplaintId,
    request: TeacherRiskReviewRequest,
    options?: TeacherRequestOptions,
  ) => Promise<TeacherRiskReviewResponse>;
  // Mock only: the spec has no "my shared complaints" endpoint, so the HTTP adapter leaves it out.
  listMyEscalations?: (signal?: AbortSignal) => Promise<MockTeacherEscalation[]>;
  // Emergency review is its own resource, independent of the admin share.
  requestEmergencyReview: (
    complaintId: ComplaintId,
    request: EmergencyReviewCreateRequest,
    options?: TeacherRequestOptions,
  ) => Promise<EmergencyReviewResponse>;
  // null when the complaint has no emergency review request (the server answers 404 EMERGENCY_REVIEW_NOT_FOUND).
  getCurrentEmergencyReview: (
    complaintId: ComplaintId,
    options?: TeacherRequestOptions,
  ) => Promise<EmergencyReviewResponse | null>;

  // Admin
  listAdminEscalations: (
    query?: AdminEscalationListQuery,
    signal?: AbortSignal,
  ) => Promise<AdminEscalationSummaryResponse[]>;
  getAdminEscalation: (escalationId: number, signal?: AbortSignal) => Promise<AdminEscalationSummaryResponse>;
  getAdminEscalationMessages: (escalationId: number, signal?: AbortSignal) => Promise<EscalationShareContentResponse>;
  getAdminEscalationRisk: (escalationId: number, signal?: AbortSignal) => Promise<TeacherRiskResponse>;
  getAdminEscalationHistory: (escalationId: number, signal?: AbortSignal) => Promise<TeacherHistoryResponse>;
  startEscalationReview: (
    escalationId: number,
    request: EscalationMessageRequest,
    signal?: AbortSignal,
  ) => Promise<EscalationStateResponse>;
  completeEscalation: (
    escalationId: number,
    request: EscalationMessageRequest,
    signal?: AbortSignal,
  ) => Promise<EscalationStateResponse>;
  // Only requests assigned to the signed-in admin as reviewer.
  listAdminEmergencyReviews: (signal?: AbortSignal) => Promise<EmergencyReviewResponse[]>;
  getAdminEmergencyReview: (requestId: number, signal?: AbortSignal) => Promise<EmergencyReviewResponse>;
  updateEmergencyReview: (
    requestId: number,
    request: EmergencyReviewUpdateRequest,
    signal?: AbortSignal,
  ) => Promise<EmergencyReviewResponse>;
};

// Fired on window after a share or admin action so open screens (lists, counts) can refetch.
export const ESCALATIONS_CHANGED_EVENT = 'escalations-changed';

export function notifyEscalationsChanged() {
  // window is undefined when the HTTP adapter runs outside the browser (Playwright unit tests).
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(ESCALATIONS_CHANGED_EVENT));
}

// The server only accepts positive integer complaint IDs; mock inbox IDs like "thread-001" never leave the browser.
export function toServerComplaintId(complaintId: ComplaintId): number | null {
  const value = typeof complaintId === 'number' ? complaintId : Number(complaintId);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}
