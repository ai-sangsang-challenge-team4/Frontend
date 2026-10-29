import type {
  ComplaintCreateRequest,
  ComplaintDraftUpdateRequest,
  ComplaintMessageResponse,
  ComplaintRecipientResponse,
  ComplaintResponse,
  ParentComplaintPageResponse,
  RiskRevisionResponse,
  RiskSummaryResponse,
  ComplaintMaskResponse,
  RiskDetectorResponse,
  ParentFollowUpResponse,
  ParentConversationResponse,
} from './parentComplaintTypes';

// New inquiries and follow-ups: server draft, masking, analysis, suggestions, and submission.
export type ParentComplaintApi = {
  listComplaints: (page: number, signal?: AbortSignal) => Promise<ParentComplaintPageResponse>;
  listRecipients: (studentId: number, signal?: AbortSignal) => Promise<ComplaintRecipientResponse[]>;
  createDraft: (request: ComplaintCreateRequest, signal?: AbortSignal) => Promise<ComplaintResponse>;
  updateDraft: (complaintId: number, request: ComplaintDraftUpdateRequest, signal?: AbortSignal) => Promise<ComplaintMessageResponse>;
  analyze: (complaintId: number, signal?: AbortSignal) => Promise<RiskSummaryResponse>;
  getFindings: (analysisId: number, signal?: AbortSignal) => Promise<RiskRevisionResponse>;
  submit: (complaintId: number, signal?: AbortSignal) => Promise<ComplaintMessageResponse>;
  getStatus: (complaintId: number, signal?: AbortSignal) => Promise<ComplaintResponse>;
  mask: (complaintId: number, signal?: AbortSignal) => Promise<ComplaintMaskResponse>;
  getDetectorResults: (analysisId: number, signal?: AbortSignal) => Promise<RiskDetectorResponse>;
  saveFollowUpDraft: (complaintId: number, request: ComplaintDraftUpdateRequest, signal?: AbortSignal) => Promise<ParentFollowUpResponse>;
  getFollowUpDraft: (complaintId: number, signal?: AbortSignal) => Promise<ParentFollowUpResponse | null>;
  analyzeFollowUp: (complaintId: number, messageId: number, signal?: AbortSignal) => Promise<RiskSummaryResponse>;
  submitFollowUp: (complaintId: number, messageId: number, signal?: AbortSignal) => Promise<ParentFollowUpResponse>;
  getConversation: (complaintId: number, signal?: AbortSignal) => Promise<ParentConversationResponse>;
};
