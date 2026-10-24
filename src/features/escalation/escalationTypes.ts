import type { AdminAction, EscalationStatus, RiskLevel } from '../../shared/types';

// Thread IDs are strings in the mock inbox; the API uses numeric complaintId.
export type ComplaintId = number | string;

export type SharedRiskFactor = {
  description: string;
  evidenceSpan: string | null;
  id: string;
  name: string;
  rationale: string;
  status: 'detected' | 'boundary';
};

export type EscalationHistoryItem = {
  changedAt: string;
  changedBy: string;
  memo?: string;
  newStatus: EscalationStatus;
  previousStatus: EscalationStatus;
};

// POST /complaints/{complaintId}/escalations
export type CreateEscalationRequest = {
  assignedAdminId: number;
  evidencePackageId?: number | null;
  reason: string;
  shareMaskedContent: boolean;
  shareOriginalContent: boolean;
};

export type CreateEscalationResponse = {
  assignedAdminId: number;
  complaintId: ComplaintId;
  escalationId: number;
  sharedAt: string;
  sharedBy: number;
  status: EscalationStatus;
};

// Escalation as the sharing teacher sees it (assumed GET /complaints/{complaintId}/escalations).
export type ComplaintEscalation = {
  adminMemo: string | null;
  assignedAdminName: string;
  complaintId: ComplaintId;
  escalationId: number;
  processedAt: string | null;
  reason: string;
  sharedAt: string;
  status: EscalationStatus;
  title: string;
};

// GET /admin/complaints item
export type AdminComplaintListItem = {
  complaintId: ComplaintId;
  escalationStatus: EscalationStatus;
  // Not in the spec example; the list needs them to tell rows apart.
  reason: string;
  riskLevel: RiskLevel;
  sharedAt: string;
  studentName: string;
  teacherName: string;
  title: string;
};

export type AdminComplaintListResponse = {
  items: AdminComplaintListItem[];
  page: number;
  size: number;
  totalElements: number;
};

export type AdminComplaintListQuery = {
  escalationStatus?: EscalationStatus;
  page?: number;
  riskLevel?: RiskLevel;
  size?: number;
};

// Assumed GET /admin/complaints/{complaintId}: only what the teacher chose to share.
export type AdminComplaintDetail = AdminComplaintListItem & {
  adminMemo: string | null;
  bufferedSummary: string | null;
  className: string;
  escalationId: number;
  evidencePackageAttached: boolean;
  history: EscalationHistoryItem[];
  maskedContent: string | null;
  originalContent: string | null;
  parentName: string;
  processedAt: string | null;
  recommendedActions: string[];
  riskFactors: SharedRiskFactor[];
  shareMaskedContent: boolean;
  shareOriginalContent: boolean;
};

// PATCH /admin/complaints/{complaintId}
export type AdminProcessRequest = {
  action: AdminAction;
  memo?: string;
};

export type AdminProcessResponse = {
  adminAction: AdminAction;
  complaintId: ComplaintId;
  escalationStatus: EscalationStatus;
  processedAt: string;
  processedBy: number;
};

// What the mock server would already know about a complaint. The HTTP adapter ignores it.
export type EscalationComplaintSnapshot = {
  bufferedSummary: string | null;
  className: string;
  maskedContent: string | null;
  originalContent: string | null;
  parentName: string;
  riskFactors: SharedRiskFactor[];
  riskLevel: RiskLevel;
  studentName: string;
  teacherName: string;
  title: string;
};

export type AdminRecipient = {
  name: string;
  role: string;
  userId: number;
};
