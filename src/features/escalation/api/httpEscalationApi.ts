import { ApiError, apiClient, isApiError } from '../../../shared/api';
import type {
  AdminEscalationSummaryResponse,
  ComplaintId,
  EmergencyReviewResponse,
  EscalationShareContentResponse,
  EscalationStateResponse,
  TeacherHistoryResponse,
  TeacherRiskResponse,
  TeacherRiskReviewResponse,
} from '../escalationTypes';
import { notifyEscalationsChanged, toServerComplaintId, type EscalationApi } from './escalationApiContract';

// Paths and shapes follow the backend controllers. Status codes are not relied on beyond 2xx:
// /v3/api-docs lists 200 for POST /emergency-review, but the server answers 201.

// Callers check canSendEscalationRequest first; this keeps a stray mock ID from ever reaching the server.
function serverComplaintId(complaintId: ComplaintId) {
  const id = toServerComplaintId(complaintId);
  if (id === null) {
    throw new ApiError({ status: 0, kind: 'BAD_REQUEST', message: '서버에 등록되지 않은 메시지라 요청을 보낼 수 없어요.' });
  }
  return id;
}

async function mutate<T>(request: Promise<T>) {
  const result = await request;
  notifyEscalationsChanged();
  return result;
}

export const httpEscalationApi: EscalationApi = {
  // async so an invalid ID rejects instead of throwing synchronously.
  getEscalationState: async (complaintId, options) =>
    apiClient.get<EscalationStateResponse>(`/teacher/complaints/${serverComplaintId(complaintId)}/escalation`, {
      signal: options?.signal,
    }),

  // 201 with a plain string body; callers refetch the state afterwards.
  shareEscalation: async (complaintId, request, options) => {
    await mutate(apiClient.post<string>(`/teacher/complaints/${serverComplaintId(complaintId)}/escalation`, request, {
      signal: options?.signal,
    }));
  },

  submitRiskReview: async (complaintId, request, options) =>
    mutate(apiClient.post<TeacherRiskReviewResponse>(
      `/teacher/complaints/${serverComplaintId(complaintId)}/risk-reviews`,
      request,
      { signal: options?.signal },
    )),

  requestEmergencyReview: async (complaintId, request, options) =>
    mutate(apiClient.post<EmergencyReviewResponse>(
      `/teacher/complaints/${serverComplaintId(complaintId)}/emergency-review`,
      request,
      { signal: options?.signal },
    )),

  getCurrentEmergencyReview: async (complaintId, options) => {
    try {
      return await apiClient.get<EmergencyReviewResponse>(
        `/teacher/complaints/${serverComplaintId(complaintId)}/emergency-review/current`,
        { signal: options?.signal },
      );
    } catch (error) {
      // 404 here means "no request yet", not a failure. COMPLAINT_NOT_FOUND still throws.
      if (isApiError(error) && error.code === 'EMERGENCY_REVIEW_NOT_FOUND') return null;
      throw error;
    }
  },

  listAdminEscalations: (query, signal) =>
    apiClient.get<AdminEscalationSummaryResponse[]>('/admin/escalations', { query, signal }),

  getAdminEscalation: (escalationId, signal) =>
    apiClient.get<AdminEscalationSummaryResponse>(`/admin/escalations/${escalationId}`, { signal }),

  getAdminEscalationMessages: (escalationId, signal) =>
    apiClient.get<EscalationShareContentResponse>(`/admin/escalations/${escalationId}/messages`, { signal }),

  getAdminEscalationRisk: (escalationId, signal) =>
    apiClient.get<TeacherRiskResponse>(`/admin/escalations/${escalationId}/risk`, { signal }),

  getAdminEscalationHistory: (escalationId, signal) =>
    apiClient.get<TeacherHistoryResponse>(`/admin/escalations/${escalationId}/history`, { signal }),

  startEscalationReview: (escalationId, request, signal) =>
    mutate(apiClient.post<EscalationStateResponse>(`/admin/escalations/${escalationId}/review`, request, { signal })),

  completeEscalation: (escalationId, request, signal) =>
    mutate(apiClient.post<EscalationStateResponse>(`/admin/escalations/${escalationId}/complete`, request, { signal })),

  listAdminEmergencyReviews: (signal) =>
    apiClient.get<EmergencyReviewResponse[]>('/admin/emergency-review', { signal }),

  getAdminEmergencyReview: (requestId, signal) =>
    apiClient.get<EmergencyReviewResponse>(`/admin/emergency-review/${requestId}`, { signal }),

  updateEmergencyReview: (requestId, request, signal) =>
    mutate(apiClient.patch<EmergencyReviewResponse>(`/admin/emergency-review/${requestId}`, request, { signal })),
};
