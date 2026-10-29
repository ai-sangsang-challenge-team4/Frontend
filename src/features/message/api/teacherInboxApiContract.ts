import type { TeacherHistoryResponse, TeacherRiskResponse } from '../../escalation/escalationTypes';
import type {
  ComplaintListQuery,
  ComplaintPageResponse,
  TeacherComplaintDetailResponse,
  TeacherConversationResponse,
  TeacherOriginalViewResponse,
} from './teacherInboxTypes';

// Read side of the teacher inbox. Replies (ai-draft, response-draft, responses) are a separate step.
export type TeacherInboxApi = {
  listComplaints: (query?: ComplaintListQuery, signal?: AbortSignal) => Promise<ComplaintPageResponse>;
  getComplaint: (complaintId: number, signal?: AbortSignal) => Promise<TeacherComplaintDetailResponse>;
  getConversation: (complaintId: number, signal?: AbortSignal) => Promise<TeacherConversationResponse>;
  getRisk: (complaintId: number, signal?: AbortSignal) => Promise<TeacherRiskResponse>;
  getHistory: (complaintId: number, signal?: AbortSignal) => Promise<TeacherHistoryResponse>;
  viewOriginal: (complaintId: number, signal?: AbortSignal) => Promise<TeacherOriginalViewResponse>;
};
