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
  TeacherOriginalViewResponse,
  TeacherResponseDraftResponse,
  TeacherResponseSubmissionResponse,
  MediationPackageResponse,
} from './teacherInboxTypes';

// POST /responses requires an Idempotency-Key. A send that got no answer (timeout, network, 5xx) may have been
// stored, so retrying the same reply reuses its key and the server returns the stored reply instead of a second one.
// The server rejects a key reused for different content, so the key belongs to one complaint and content.
const pendingReplyKeys = new Map<string, string>();
const pendingPackageKeys = new Map<string, { key: string; uncertain: boolean }>();
// Keep mismatched success responses blocked across both creation entry points and component remounts.
const unconfirmedPackages = new Set<number>();

export class MediationPackageUnconfirmedError extends Error {
  constructor() {
    super('생성 응답을 확인할 수 없습니다. 패키지가 이미 생성됐을 수 있어 이 문의의 추가 생성을 중단했습니다. 관리자에게 생성 여부 확인을 요청해 주세요.');
    this.name = 'MediationPackageUnconfirmedError';
  }
}

// Paths follow the backend TeacherComplaintController and TeacherResponseTemplateController.
export const httpTeacherInboxApi: TeacherInboxApi = {
  createMediationPackage: async (complaintId, includeOriginalMessages) => {
    if (unconfirmedPackages.has(complaintId)) throw new MediationPackageUnconfirmedError();
    const attempt = `${complaintId}:${includeOriginalMessages}`;
    const pending = pendingPackageKeys.get(attempt) ?? { key: crypto.randomUUID(), uncertain: false };
    pendingPackageKeys.set(attempt, pending);
    try {
      const response = await apiClient.post<MediationPackageResponse>(
        `/teacher/complaints/${complaintId}/mediation-packages`,
        { includeOriginalMessages },
        { headers: { 'Idempotency-Key': pending.key } },
      );
      // Validate before retiring the key: HTTP success alone does not confirm which package was created.
      if (response?.complaintId !== complaintId || typeof response.packageId !== 'string' || !response.packageId.trim() ||
          response.originalMessagesIncluded !== includeOriginalMessages) {
        unconfirmedPackages.add(complaintId);
        throw new MediationPackageUnconfirmedError();
      }
      pendingPackageKeys.delete(attempt);
      return response;
    } catch (error) {
      if (isApiError(error) && error.status >= 400 && error.status < 500) {
        // A later rejection cannot establish whether an earlier, unanswered attempt was stored.
        if (!pending.uncertain) pendingPackageKeys.delete(attempt);
      } else pending.uncertain = true;
      throw error;
    }
  },
  getMediationPackage: (complaintId, packageId) =>
    apiClient.get<MediationPackageResponse>(`/teacher/complaints/${complaintId}/mediation-packages/${encodeURIComponent(packageId)}`),
  downloadMediationPackage: (complaintId, packageId) =>
    apiClient.get<Blob>(`/teacher/complaints/${complaintId}/mediation-packages/${encodeURIComponent(packageId)}/download`, { responseType: 'blob' }),
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
