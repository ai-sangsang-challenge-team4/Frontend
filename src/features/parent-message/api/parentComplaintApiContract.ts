import type {
  ComplaintCreateRequest,
  ComplaintDraftUpdateRequest,
  ComplaintMessageResponse,
  ComplaintRecipientResponse,
  ComplaintResponse,
  ParentComplaintPageResponse,
  RiskRevisionResponse,
  RiskSummaryResponse,
} from './parentComplaintTypes';

// The parent's new inquiry: server draft, analysis, revision suggestions, and submission.
export type ParentComplaintApi = {
  listComplaints: (page: number, signal?: AbortSignal) => Promise<ParentComplaintPageResponse>;
  listRecipients: (studentId: number, signal?: AbortSignal) => Promise<ComplaintRecipientResponse[]>;
  createDraft: (request: ComplaintCreateRequest, signal?: AbortSignal) => Promise<ComplaintResponse>;
  updateDraft: (complaintId: number, request: ComplaintDraftUpdateRequest, signal?: AbortSignal) => Promise<ComplaintMessageResponse>;
  analyze: (complaintId: number, signal?: AbortSignal) => Promise<RiskSummaryResponse>;
  getFindings: (analysisId: number, signal?: AbortSignal) => Promise<RiskRevisionResponse>;
  submit: (complaintId: number, signal?: AbortSignal) => Promise<ComplaintMessageResponse>;
  getStatus: (complaintId: number, signal?: AbortSignal) => Promise<ComplaintResponse>;
};
