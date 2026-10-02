export type MessageStatus =
  | 'DRAFT'
  | 'ANALYZING'
  | 'PARENT_REVIEW'
  | 'SENT'
  | 'TEACHER_REVIEW'
  | 'RESPONSE_DRAFTED'
  | 'SENT_TO_PARENT'
  | 'RESOLVED';

export type ComplaintType =
  | 'GENERAL_INQUIRY'
  | 'COUNSELING_REQUEST'
  | 'COMPLAINT'
  | 'EVALUATION_OBJECTION'
  | 'STUDENT_GUIDANCE'
  | 'OTHER';
