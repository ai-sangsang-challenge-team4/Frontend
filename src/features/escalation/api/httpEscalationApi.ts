import { apiClient, isApiError } from '../../../shared/api';
import type {
  AdminComplaintDetail,
  AdminComplaintListResponse,
  AdminProcessResponse,
  AdminRecipient,
  ComplaintEscalation,
  CreateEscalationResponse,
} from '../escalationTypes';
import type { EscalationApi } from './escalationApiContract';

// Endpoints marked "assumed" are not in the API spec yet; see docs/admin-escalation.md.
export const httpEscalationApi: EscalationApi = {
  // assumed
  getAdminRecipients: (signal) => apiClient.get<AdminRecipient[]>('/admins', { signal }),

  createEscalation: (complaintId, request, options) =>
    apiClient.post<CreateEscalationResponse>(`/complaints/${complaintId}/escalations`, request, {
      signal: options?.signal,
    }),

  // assumed
  getComplaintEscalation: async (complaintId, signal) => {
    try {
      return await apiClient.get<ComplaintEscalation>(`/complaints/${complaintId}/escalations`, { signal });
    } catch (error) {
      if (isApiError(error) && error.kind === 'NOT_FOUND') return null;
      throw error;
    }
  },

  // assumed
  listMyEscalations: (signal) =>
    apiClient.get<ComplaintEscalation[]>('/escalations', { query: { scope: 'mine' }, signal }),

  listAdminComplaints: (query, signal) =>
    apiClient.get<AdminComplaintListResponse>('/admin/complaints', { query, signal }),

  // assumed
  getAdminComplaint: (complaintId, signal) =>
    apiClient.get<AdminComplaintDetail>(`/admin/complaints/${complaintId}`, { signal }),

  processAdminComplaint: (complaintId, request, signal) =>
    apiClient.patch<AdminProcessResponse>(`/admin/complaints/${complaintId}`, request, { signal }),
};
