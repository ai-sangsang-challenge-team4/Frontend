import type { ThreadActivityLog } from '../parent-message/parentMessageTypes';
import type { ReplyTemplate, ReplyTemplateDraft } from './replyTemplates';
import type { RiskClassification } from '../risk-analysis';
import type { ComplaintStatus, RiskReviewStatus, WaitingFor } from '../../shared/types';

export type ThreadStatus = 'before' | 'inProgress' | 'complete';
export type RiskLevel = 'normal' | 'attention' | 'danger' | 'urgent';
export type SystemRiskLevel = 'low' | 'medium' | 'high' | 'emergency';
export type StudentSafetySignal = 'NONE' | 'POSSIBLE' | 'URGENT_REVIEW';
export type RiskFactorStatus = 'detected' | 'boundary' | 'unknown';
export type SummaryStatus = 'ready' | 'failed';
export type ThreadTab = 'all' | 'starred' | 'drafts';
export type DetailTab = 'conversation' | 'risk' | 'activity';
export type ReplyDraftTab = 'ai' | 'manual';
export type ReplyDraftState = {
  draftText: string;
  draftSavedAt?: string;
  aiDraftGenerated?: boolean;
  officialTemplateApplied?: boolean;
  appliedTemplate?: ReplyTemplateDraft;
};
export type FilterValue = 'active' | 'complete' | 'all';
export type RiskFilterValue = 'all' | SystemRiskLevel;
// 'oldest' is offered only for the server inbox, whose sort is LATEST or OLDEST.
export type SortValue = 'latest' | 'oldest' | 'risk' | 'status';
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
  // Omitted by existing fixtures; a populated analysis was ready before status was added.
  status?: 'ready' | 'loading' | 'failed';
  riskClassifications?: RiskClassification[];
  aiObjections?: AiObjection[];
  activityLogs: ActivityLog[];
  canReviewRisk: boolean;
  canViewActivityLog: boolean;
  // Server inbox: GET /history failed, so activityLogs are the last ones loaded (possibly none).
  activityLogsUnavailable?: boolean;
  canViewOriginal: boolean;
  originalMessageAvailable: boolean;
  packageAvailable: boolean;
  riskFactors: RiskFactor[];
  riskReviewRequestedAt?: string;
  safetyLock: boolean;
  // Last known server state of the teacher's own emergency review request. The admin decides on the
  // server, so the thread syncs from GET /escalation once the status or lock changes.
  emergencyReview?: { requestId: number; status: RiskReviewStatus; safetyLock: boolean };
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
  // Server inbox: a parent message above LOW arrives as its buffered summary instead of the original.
  summarized?: boolean;
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
  // Set for threads read from GET /teacher/complaints (VITE_MESSAGE_API=http); the id is this number as a string.
  serverComplaintId?: number;
  serverStatus?: { status: ComplaintStatus; waitingFor: WaitingFor };
  // Server inbox: GET /response-draft was checked once this session, so a cleared tab is not refilled.
  serverDraftChecked?: boolean;
  // Server inbox: High templates from GET /response-templates, loaded on entering the composer. They replace
  // the browser examples for this thread.
  serverTemplates?: ReplyTemplate[];
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
  replyDraftTab?: ReplyDraftTab;
  replyDrafts?: Partial<Record<ReplyDraftTab, ReplyDraftState>>;
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
  // Server threads: the conversation message whose original to open. Unset opens the latest parent message.
  replyId?: string;
  source?: 'detail' | 'replyComposer';
};
