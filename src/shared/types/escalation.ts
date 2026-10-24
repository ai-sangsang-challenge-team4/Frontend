export type EscalationStatus =
  | 'NOT_SHARED'
  | 'SHARED'
  | 'UNDER_REVIEW'
  | 'COMPLETED'
  | 'RETURNED_TO_TEACHER';

// PATCH /admin/complaints/{complaintId} action. The spec defines only REVIEW_COMPLETE;
// START_REVIEW is the frontend's assumption for SHARED → UNDER_REVIEW until the backend confirms it.
export type AdminAction = 'START_REVIEW' | 'REVIEW_COMPLETE';
