import type { ThreadActivityLog } from '../parent-message/parentMessageTypes';
import type { ReplyTemplateDraft } from './replyTemplates';

export type ThreadStatus = 'before' | 'inProgress' | 'complete';
export type RiskLevel = 'normal' | 'attention' | 'danger' | 'urgent';
export type SystemRiskLevel = 'low' | 'medium' | 'high' | 'emergency';
export type StudentSafetySignal = 'NONE' | 'POSSIBLE' | 'URGENT_REVIEW';
export type RiskFactorStatus = 'detected' | 'boundary' | 'unknown';
export type SummaryStatus = 'ready' | 'failed';
export type ThreadTab = 'all' | 'starred' | 'drafts';
export type DetailTab = 'conversation' | 'risk' | 'activity';
export type FilterValue = 'active' | 'complete' | 'all';
export type RiskFilterValue = 'all' | SystemRiskLevel;
export type SortValue = 'latest' | 'risk' | 'status';
// Teacher's own 1 (very safe) to 7 (very dangerous) rating; it maps onto SystemRiskLevel for locks and templates.
export type RiskScore = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type AiObjectionType = 'overestimated' | 'underestimated' | 'wrongEvidence' | 'other';
export type RiskGuideAction = 'original' | 'procedure';
export type MessagesRouteView = 'detail' | 'reply';
export type RiskFactorIconKind =
  | 'burden'
  | 'default'
  | 'official'
  | 'repeat'
  | 'safety';

export type BufferedSummary = {
  status: SummaryStatus;
  text: string;
};

export type RiskFactor = {
  description: string;
  evidence: string;
  id: string;
  name: string;
  rationale: string;
  status: RiskFactorStatus;
};

export type ActivityLog = ThreadActivityLog;

// A teacher's report that the AI judgement was wrong; collected as misjudgement cases for evaluation.
export type AiObjection = {
  createdAt: string;
  id: string;
  reason: string;
  type: AiObjectionType;
};

export type ThreadAnalysis = {
  aiObjections?: AiObjection[];
  activityLogs: ActivityLog[];
  canReviewRisk: boolean;
  canViewActivityLog: boolean;
  canViewOriginal: boolean;
  originalMessageAvailable: boolean;
  packageAvailable: boolean;
  riskFactors: RiskFactor[];
  safetyLock: boolean;
  studentSafetySignal: StudentSafetySignal;
  summary: BufferedSummary;
  systemRiskLevel: SystemRiskLevel;
  teacherReviewReason?: string;
  teacherReviewedRiskLevel?: SystemRiskLevel;
  teacherRiskScore?: RiskScore;
};

export type BoardReply = {
  authorName: string;
  authorRole: 'parent' | 'teacher';
  content: string;
  id: string;
  label: string;
  // Set once the reply is stored as the final answer delivered to the parent.
  deliveryStatus?: 'SENT_TO_PARENT';
  readByParent?: boolean;
  time: string;
  sentAt?: string;
};

// AI summary of the whole conversation: its topic and what the parent is asking for.
export type ConversationSummary = {
  topic: string;
  text: string;
};

export type BoardThread = {
  conversationSummary?: ConversationSummary;
  parentUserId?: number;
  needsTeacherReview?: boolean;
  parentAcknowledgedAt?: string;
  analysis?: ThreadAnalysis;
  // Used only when there is no analysis, e.g. threads loaded from parent messages.
  activityLogs?: ActivityLog[];
  aiDraftGenerated?: boolean;
  className: string;
  draftSavedAt?: string;
  draftText: string;
  evidencePackageGenerated?: boolean;
  id: string;
  isPinned: boolean;
  latestAt: string;
  latestAtLabel: string;
  latestMessage: string;
  messageDateLabel?: string;
  moderatedSummary?: string;
  officialTemplateApplied?: boolean;
  // The High template version the current draft was built from; checked again before sending.
  appliedTemplate?: ReplyTemplateDraft;
  officialTemplates?: string[];
  originalMessage?: string;
  parentName: string;
  // Mock switch for a regulation search timeout until the RAG API is connected.
  ragSearchFailed?: boolean;
  replies: BoardReply[];
  risk: RiskLevel;
  riskReviewRequired: boolean;
  status: ThreadStatus;
  studentName: string;
  title: string;
};

export type RiskReviewSubmission = {
  reason: string;
  score: RiskScore;
};

export type OriginalMessageRequest = {
  evidence?: string;
  source?: 'detail' | 'replyComposer';
};
