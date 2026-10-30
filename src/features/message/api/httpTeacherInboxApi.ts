import { apiClient, isApiError } from '../../../shared/api';
import type { TeacherHistoryResponse, TeacherRiskResponse } from '../../escalation/escalationTypes';
import type { TeacherInboxApi } from './teacherInboxApiContract';
import type {
  ComplaintPageResponse,
  ResponseTemplateAdoptionResponse,
  ResponseTemplateResponse,
  TeacherComplaintDetailResponse,
  TeacherConversationResponse,
  TeacherAiDraftResponse,
  TeacherCloseResponse,
  TeacherOriginalViewResponse,
  TeacherResponseDraftResponse,
  TeacherResponseSubmissionResponse,
} from './teacherInboxTypes';

// POST /responses requires an Idempotency-Key. A send that got no answer (timeout, network, 5xx) may have been
// stored, so retrying the same reply reuses its key and the server returns the stored reply instead of a second one.
// The server rejects a key reused for different content, so the key belongs to one complaint and content.
const pendingReplyKeys = new Map<string, string>();

// Paths follow the backend TeacherComplaintController and TeacherResponseTemplateController.
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

  viewOriginal: (complaintId, messageId, signal) =>
    apiClient.post<TeacherOriginalViewResponse>(
      `/teacher/complaints/${complaintId}/messages/${messageId}/original-views`,
      undefined,
      { signal },
    ),

  closeComplaint: (complaintId) =>
    apiClient.post<TeacherCloseResponse>(`/teacher/complaints/${complaintId}/close`),

  generateAiDraft: (complaintId) =>
    apiClient.post<TeacherAiDraftResponse>(`/teacher/complaints/${complaintId}/response/ai-draft`),

  getResponseDraft: (complaintId, signal) =>
    apiClient.get<TeacherResponseDraftResponse>(`/teacher/complaints/${complaintId}/response-draft`, { signal }),

  saveResponseDraft: (complaintId, request) =>
    apiClient.put<TeacherResponseDraftResponse>(`/teacher/complaints/${complaintId}/response-draft`, request),

  submitResponse: async (complaintId, request) => {
    const attempt = `${complaintId}:${request.content}`;
    const key = pendingReplyKeys.get(attempt) ?? crypto.randomUUID();
    pendingReplyKeys.set(attempt, key);
    try {
      const response = await apiClient.post<TeacherResponseSubmissionResponse>(
        `/teacher/complaints/${complaintId}/responses`,
        request,
        { headers: { 'Idempotency-Key': key } },
      );
      pendingReplyKeys.delete(attempt);
      return response;
    } catch (error) {
      // A 4xx was refused and stored nothing, so a later send of the same text is a new reply.
      if (isApiError(error) && error.status >= 400 && error.status < 500) pendingReplyKeys.delete(attempt);
      throw error;
    }
  },

  getResponseTemplates: (complaintId, signal) =>
    apiClient.get<ResponseTemplateResponse[]>(`/teacher/complaints/${complaintId}/response-templates`, { signal }),

  adoptResponseTemplate: (complaintId, versionId, request) =>
    apiClient.post<ResponseTemplateAdoptionResponse>(
      `/teacher/complaints/${complaintId}/response-templates/${versionId}/adoptions`,
      request,
    ),
};
