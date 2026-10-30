import type { TeacherHistoryResponse, TeacherRiskResponse } from '../../escalation/escalationTypes';
import type {
  ComplaintListQuery,
  ComplaintPageResponse,
  TeacherComplaintDetailResponse,
  TeacherConversationResponse,
  ResponseTemplateAdoptionRequest,
  ResponseTemplateAdoptionResponse,
  ResponseTemplateResponse,
  TeacherAiDraftResponse,
  TeacherCloseResponse,
  TeacherOriginalViewResponse,
  TeacherResponseDraftResponse,
  TeacherResponseRequest,
  TeacherResponseSubmissionResponse,
} from './teacherInboxTypes';

// The teacher inbox (list, detail, conversation, risk, history, original), the teacher's reply and High
// templates, and closing.
export type TeacherInboxApi = {
  listComplaints: (query?: ComplaintListQuery, signal?: AbortSignal) => Promise<ComplaintPageResponse>;
  getComplaint: (complaintId: number, signal?: AbortSignal) => Promise<TeacherComplaintDetailResponse>;
  getConversation: (complaintId: number, signal?: AbortSignal) => Promise<TeacherConversationResponse>;
  getRisk: (complaintId: number, signal?: AbortSignal) => Promise<TeacherRiskResponse>;
  getHistory: (complaintId: number, signal?: AbortSignal) => Promise<TeacherHistoryResponse>;
  viewOriginal: (complaintId: number, messageId: number, signal?: AbortSignal) => Promise<TeacherOriginalViewResponse>;
  closeComplaint: (complaintId: number) => Promise<TeacherCloseResponse>;
  generateAiDraft: (complaintId: number) => Promise<TeacherAiDraftResponse>;
  getResponseDraft: (complaintId: number, signal?: AbortSignal) => Promise<TeacherResponseDraftResponse>;
  saveResponseDraft: (complaintId: number, request: TeacherResponseRequest) => Promise<TeacherResponseDraftResponse>;
  submitResponse: (complaintId: number, request: TeacherResponseRequest) => Promise<TeacherResponseSubmissionResponse>;
  getResponseTemplates: (complaintId: number, signal?: AbortSignal) => Promise<ResponseTemplateResponse[]>;
  adoptResponseTemplate: (
    complaintId: number,
    versionId: number,
    request: ResponseTemplateAdoptionRequest,
  ) => Promise<ResponseTemplateAdoptionResponse>;
};
