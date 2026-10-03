export type ThreadStatus = 'before' | 'inProgress' | 'complete';
export type RiskLevel = 'normal' | 'attention' | 'danger' | 'urgent';
export type SystemRiskLevel = 'low' | 'medium' | 'high' | 'emergency';
export type StudentSafetySignal = 'NONE' | 'POSSIBLE' | 'URGENT_REVIEW';
export type RiskFactorStatus = 'detected' | 'boundary' | 'unknown';
export type SummaryStatus = 'ready' | 'failed';
export type ThreadTab = 'all' | 'starred' | 'drafts';
export type DetailTab = 'conversation' | 'risk' | 'activity';
export type FilterValue = 'all' | 'active' | 'complete';
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

export type ActivityLog = {
  action: string;
  actor: string;
  detail: string;
  id: string;
  time: string;
};

export type ThreadAnalysis = {
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
};

export type BoardReply = {
  authorName: string;
  authorRole: 'parent' | 'teacher';
  content: string;
  id: string;
  label: string;
  readByParent?: boolean;
  time: string;
};

export type BoardThread = {
  analysis?: ThreadAnalysis;
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
  officialTemplates?: string[];
  originalMessage?: string;
  parentName: string;
  replies: BoardReply[];
  risk: RiskLevel;
  riskReviewRequired: boolean;
  status: ThreadStatus;
  studentName: string;
  title: string;
};

export type RiskReviewSubmission = {
  level: SystemRiskLevel;
  reason: string;
};

export type OriginalMessageRequest = {
  evidence?: string;
  source?: 'detail' | 'replyComposer';
};
