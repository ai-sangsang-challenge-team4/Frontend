import { apiClient } from '../../../shared/api';
import type { TeacherHistoryResponse, TeacherRiskResponse } from '../../escalation/escalationTypes';
import type { TeacherInboxApi } from './teacherInboxApiContract';
import type {
  ComplaintPageResponse,
  TeacherComplaintDetailResponse,
  TeacherConversationResponse,
  TeacherOriginalViewResponse,
} from './teacherInboxTypes';

// Paths follow the backend TeacherComplaintController.
export const httpTeacherInboxApi: TeacherInboxApi = {
  listComplaints: (query = {}, signal) =>
    apiClient.get<ComplaintPageResponse>('/teacher/complaints', {
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
    apiClient.get<TeacherComplaintDetailResponse>(`/teacher/complaints/${complaintId}`, { signal }),

  getConversation: (complaintId, signal) =>
    apiClient.get<TeacherConversationResponse>(`/teacher/complaints/${complaintId}/messages`, { signal }),

  getRisk: (complaintId, signal) =>
    apiClient.get<TeacherRiskResponse>(`/teacher/complaints/${complaintId}/risk`, { signal }),

  getHistory: (complaintId, signal) =>
    apiClient.get<TeacherHistoryResponse>(`/teacher/complaints/${complaintId}/history`, { signal }),

  viewOriginal: (complaintId, signal) =>
    apiClient.post<TeacherOriginalViewResponse>(`/teacher/complaints/${complaintId}/original-views`, undefined, {
      signal,
    }),
};
