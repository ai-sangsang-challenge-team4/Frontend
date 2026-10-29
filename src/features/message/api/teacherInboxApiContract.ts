import type { TeacherHistoryResponse, TeacherRiskResponse } from '../../escalation/escalationTypes';
import type {
  ComplaintListQuery,
  ComplaintPageResponse,
  TeacherComplaintDetailResponse,
  TeacherConversationResponse,
  TeacherAiDraftResponse,
  TeacherOriginalViewResponse,
  TeacherResponseDraftResponse,
  TeacherResponseRequest,
  TeacherResponseSubmissionResponse,
} from './teacherInboxTypes';

// The teacher inbox (list, detail, conversation, risk, history, original) and the teacher's reply.
export type TeacherInboxApi = {
  listComplaints: (query?: ComplaintListQuery, signal?: AbortSignal) => Promise<ComplaintPageResponse>;
  getComplaint: (complaintId: number, signal?: AbortSignal) => Promise<TeacherComplaintDetailResponse>;
  getConversation: (complaintId: number, signal?: AbortSignal) => Promise<TeacherConversationResponse>;
  getRisk: (complaintId: number, signal?: AbortSignal) => Promise<TeacherRiskResponse>;
  getHistory: (complaintId: number, signal?: AbortSignal) => Promise<TeacherHistoryResponse>;
  viewOriginal: (complaintId: number, signal?: AbortSignal) => Promise<TeacherOriginalViewResponse>;
  generateAiDraft: (complaintId: number) => Promise<TeacherAiDraftResponse>;
  getResponseDraft: (complaintId: number, signal?: AbortSignal) => Promise<TeacherResponseDraftResponse>;
  saveResponseDraft: (complaintId: number, request: TeacherResponseRequest) => Promise<TeacherResponseDraftResponse>;
  submitResponse: (complaintId: number, request: TeacherResponseRequest) => Promise<TeacherResponseSubmissionResponse>;
};
