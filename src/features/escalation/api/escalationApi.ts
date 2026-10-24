import type { EscalationApi } from './escalationApiContract';
import { mockEscalationApi } from './mockEscalationApi';

// Swap to httpEscalationApi once the escalation endpoints are live.
const api: EscalationApi = mockEscalationApi;

export const {
  getAdminRecipients,
  createEscalation,
  getComplaintEscalation,
  listMyEscalations,
  listAdminComplaints,
  getAdminComplaint,
  processAdminComplaint,
} = api;

export { ESCALATIONS_CHANGED_EVENT } from './escalationApiContract';
export type { CreateEscalationOptions, EscalationApi } from './escalationApiContract';
export { httpEscalationApi } from './httpEscalationApi';
