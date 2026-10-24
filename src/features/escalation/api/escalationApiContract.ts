import type {
  AdminComplaintDetail,
  AdminComplaintListQuery,
  AdminComplaintListResponse,
  AdminProcessRequest,
  AdminProcessResponse,
  AdminRecipient,
  ComplaintEscalation,
  ComplaintId,
  CreateEscalationRequest,
  CreateEscalationResponse,
  EscalationComplaintSnapshot,
} from '../escalationTypes';

export type CreateEscalationOptions = {
  signal?: AbortSignal;
  // Mock only: the complaint data a real server already has.
  snapshot?: EscalationComplaintSnapshot;
};

export type EscalationApi = {
  // Teacher
  getAdminRecipients: (signal?: AbortSignal) => Promise<AdminRecipient[]>;
  createEscalation: (
    complaintId: ComplaintId,
    request: CreateEscalationRequest,
    options?: CreateEscalationOptions,
  ) => Promise<CreateEscalationResponse>;
  // Resolves null when the complaint has not been shared.
  getComplaintEscalation: (complaintId: ComplaintId, signal?: AbortSignal) => Promise<ComplaintEscalation | null>;
  listMyEscalations: (signal?: AbortSignal) => Promise<ComplaintEscalation[]>;
  // Admin
  listAdminComplaints: (query?: AdminComplaintListQuery, signal?: AbortSignal) => Promise<AdminComplaintListResponse>;
  getAdminComplaint: (complaintId: ComplaintId, signal?: AbortSignal) => Promise<AdminComplaintDetail>;
  processAdminComplaint: (
    complaintId: ComplaintId,
    request: AdminProcessRequest,
    signal?: AbortSignal,
  ) => Promise<AdminProcessResponse>;
};

// Fired on window after the mock store changes so open screens can refetch.
export const ESCALATIONS_CHANGED_EVENT = 'escalations-changed';
