import type { ComplaintId } from '../escalationTypes';
import { toServerComplaintId, type EscalationApi } from './escalationApiContract';
import { httpEscalationApi } from './httpEscalationApi';
import { mockEscalationApi } from './mockEscalationApi';

// VITE_ESCALATION_API=http calls the backend. Mock stays the default until login issues real JWTs.
export const escalationApiMode: 'mock' | 'http' =
  import.meta.env?.VITE_ESCALATION_API === 'http' ? 'http' : 'mock';

const api: EscalationApi = escalationApiMode === 'http' ? httpEscalationApi : mockEscalationApi;

// The mock accepts inbox thread IDs; over HTTP only a numeric complaintId may be sent.
export function canSendEscalationRequest(complaintId: ComplaintId) {
  return escalationApiMode === 'mock' || toServerComplaintId(complaintId) !== null;
}

export const {
  getEscalationState,
  shareEscalation,
  submitRiskReview,
  listMyEscalations,
  listAdminEscalations,
  getAdminEscalation,
  getAdminEscalationMessages,
  getAdminEscalationRisk,
  getAdminEscalationHistory,
  startEscalationReview,
  completeEscalation,
  decideRiskChange,
} = api;

export { ESCALATIONS_CHANGED_EVENT } from './escalationApiContract';
export type { EscalationApi, TeacherRequestOptions } from './escalationApiContract';
export { httpEscalationApi } from './httpEscalationApi';
