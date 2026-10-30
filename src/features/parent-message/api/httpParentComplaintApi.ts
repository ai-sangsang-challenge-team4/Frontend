import { apiClient, isApiError } from '../../../shared/api';
import type { UserInfoResponse } from '../../auth/api/authTypes';
import type { ParentComplaintApi } from './parentComplaintApiContract';
import type {
  ComplaintMessageResponse,
  ComplaintRecipientResponse,
  ComplaintResponse,
  ParentComplaintDetailResponse,
  ParentComplaintPageResponse,
  RiskRevisionResponse,
  RiskSummaryResponse,
  ComplaintMaskResponse,
  RiskDetectorResponse,
  ParentFollowUpResponse,
  ParentConversationResponse,
} from './parentComplaintTypes';

// Paths follow the backend ParentComplaintController, RiskAnalysisController, and UserController (/users/me).
export const httpParentComplaintApi: ParentComplaintApi = {
  listComplaints: (query = {}, signal) =>
    apiClient.get<ParentComplaintPageResponse>('/complaints', {
      query: {
        page: query.page,
        keyword: query.keyword?.trim() || undefined,
        status: query.status,
        riskLevel: query.riskLevel,
        sort: query.sort,
      },
      signal,
    }),

  getComplaint: (complaintId, signal) =>
    apiClient.get<ParentComplaintDetailResponse>(`/complaints/${complaintId}`, { signal }),

  getMe: (signal) =>
    apiClient.get<UserInfoResponse>('/users/me', { signal }),

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

  mask: (complaintId, signal) =>
    apiClient.post<ComplaintMaskResponse>(`/complaints/${complaintId}/mask`, undefined, { signal }),

  getDetectorResults: (analysisId, signal) =>
    apiClient.get<RiskDetectorResponse>(`/risk-analyses/${analysisId}/detector-results`, { signal }),

  saveFollowUpDraft: (complaintId, request, signal) =>
    apiClient.put<ParentFollowUpResponse>(`/complaints/${complaintId}/message-draft`, request, { signal }),

  getFollowUpDraft: async (complaintId, signal) => {
    try {
      return await apiClient.get<ParentFollowUpResponse>(`/complaints/${complaintId}/message-draft`, { signal });
    } catch (error) {
      if (isApiError(error) && error.code === 'MESSAGE_DRAFT_NOT_FOUND') return null;
      throw error;
    }
  },

  analyzeFollowUp: (complaintId, messageId, signal) =>
    apiClient.post<RiskSummaryResponse>(`/complaints/${complaintId}/messages/${messageId}/risk-analysis`, undefined, { signal }),

  submitFollowUp: (complaintId, messageId, request, signal) =>
    apiClient.post<ParentFollowUpResponse>(`/complaints/${complaintId}/messages/${messageId}/send`, request, { signal }),

  getConversation: (complaintId, signal) =>
    apiClient.get<ParentConversationResponse>(`/complaints/${complaintId}/messages`, { signal }),
};
