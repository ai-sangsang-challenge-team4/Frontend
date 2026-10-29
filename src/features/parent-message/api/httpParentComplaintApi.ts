import { apiClient } from '../../../shared/api';
import type { ParentComplaintApi } from './parentComplaintApiContract';
import type {
  ComplaintMessageResponse,
  ComplaintRecipientResponse,
  ComplaintResponse,
  ParentComplaintPageResponse,
  RiskRevisionResponse,
  RiskSummaryResponse,
} from './parentComplaintTypes';

// Paths follow the backend ParentComplaintController and RiskAnalysisController.
export const httpParentComplaintApi: ParentComplaintApi = {
  listComplaints: (page, signal) =>
    apiClient.get<ParentComplaintPageResponse>('/complaints', { query: { page }, signal }),

  listRecipients: (studentId, signal) =>
    apiClient.get<ComplaintRecipientResponse[]>('/complaints/recipients', { query: { studentId }, signal }),

  createDraft: (request, signal) =>
    apiClient.post<ComplaintResponse>('/complaints', request, { signal }),

  updateDraft: (complaintId, request, signal) =>
    apiClient.patch<ComplaintMessageResponse>(`/complaints/${complaintId}`, request, { signal }),

  analyze: (complaintId, signal) =>
    apiClient.post<RiskSummaryResponse>(`/complaints/${complaintId}/risk-analysis`, undefined, { signal }),

  getFindings: (analysisId, signal) =>
    apiClient.get<RiskRevisionResponse>(`/risk-analyses/${analysisId}/findings`, { signal }),

  submit: (complaintId, signal) =>
    apiClient.post<ComplaintMessageResponse>(`/complaints/${complaintId}/send`, undefined, { signal }),

  getStatus: (complaintId, signal) =>
    apiClient.get<ComplaintResponse>(`/complaints/${complaintId}/status`, { signal }),
};
