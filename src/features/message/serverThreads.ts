import { toServerInstant } from '../../shared/api';
import type { ComplaintStatus, RiskLevel as ApiRiskLevel, WaitingFor } from '../../shared/types';
import type { DetectedFactorCode, HistoryEvent, TeacherRiskResponse } from '../escalation/escalationTypes';
import { historyEventLabel } from '../escalation/escalationRules';
import { formatMessageDate } from '../parent-message/conversation';
import { riskCategories, type RiskClassification } from '../risk-analysis';
import type {
  ComplaintListItem,
  ComplaintListQuery,
  TeacherComplaintDetailResponse,
  TeacherConversationResponse,
} from './api/teacherInboxTypes';
import { systemRiskLevelFromApi } from './escalationSnapshot';
import { formatConversationDate, formatConversationTime } from './messageDates';
import { systemRiskLabel, systemRiskTone } from './messageRules';
import type {
  ActivityLog,
  BoardReply,
  BoardThread,
  FilterValue,
  RiskFilterValue,
  RiskScore,
  SortValue,
  ThreadAnalysis,
  ThreadStatus,
} from './types';

// Converts the backend teacher complaint responses into the inbox's BoardThread model.
// Fields the backend has no data for (student safety signal, AI objections, evidence package, pin, reply
// drafts) keep their local defaults and stay browser-local.

// Backend tag codes and the inbox's classification codes describe the same eight risks.
const classificationCodeByTag: Record<DetectedFactorCode, RiskClassification['code']> = {
  PROFANITY: 'EMOTIONAL_EXPRESSION',
  INSULT: 'PERSONAL_ATTACK',
  THREAT: 'THREAT',
  LEGAL: 'LEGAL_ADMINISTRATIVE_ACTION',
  EXPOSURE: 'PUBLIC_DISCLOSURE_THREAT',
  REPEAT: 'REPETITION',
  UNFAIR_REQUEST: 'UNREASONABLE_DEMAND',
  PRIVACY: 'PERSONAL_INFORMATION_RISK',
};

const complaintStatusLabel: Record<ComplaintStatus, string> = {
  DRAFT: '작성 중',
  OPEN: '진행 중',
  CLOSED: '종료',
};

export function toServerComplaintNumber(threadId: string) {
  const value = Number(threadId);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function className(grade: number | null, classNo: number | null) {
  return grade === null || classNo === null ? '' : `${grade}학년 ${classNo}반`;
}

// The inbox has 상담 전·상담 중·상담 완료; the server has complaint status plus whose turn it is.
function threadStatus(status: ComplaintStatus, waitingFor: WaitingFor, hasTeacherReply?: boolean): ThreadStatus {
  if (status === 'CLOSED' || waitingFor === 'NONE') return 'complete';
  if (waitingFor === 'PARENT' || hasTeacherReply) return 'inProgress';
  return 'before';
}

function riskTone(level: ApiRiskLevel | null) {
  return systemRiskTone[systemRiskLevelFromApi[level ?? 'LOW']];
}

// GET /teacher/complaints row. Details arrive with mergeServerDetail when the thread is opened.
export function toListThread(item: ComplaintListItem): BoardThread {
  const latestAt = toServerInstant(item.latestReceivedAt) ?? '';
  const summary = item.aiSummary?.trim() ?? '';
  return {
    id: String(item.complaintId),
    serverComplaintId: item.complaintId,
    serverStatus: { status: item.status, waitingFor: item.waitingFor },
    title: item.title,
    parentName: item.counterpartName?.trim() || '학부모',
    studentName: item.studentName,
    className: className(item.grade, item.classNo),
    latestAt,
    latestAtLabel: latestAt ? formatMessageDate(latestAt) : '',
    latestMessage: summary,
    conversationSummary: summary ? { topic: item.title, text: summary } : undefined,
    status: threadStatus(item.status, item.waitingFor),
    risk: riskTone(item.riskLevel),
    riskReviewRequired: false,
    isPinned: false,
    draftText: '',
    replies: [],
  };
}

export type ServerThreadDetail = {
  detail: TeacherComplaintDetailResponse;
  conversation: TeacherConversationResponse;
  // null when the risk request failed (e.g. 404 RISK_ANALYSIS_NOT_FOUND); the thread shows the analysis as failed.
  risk: TeacherRiskResponse | null;
  history: HistoryEvent[];
};

function toReplies(conversation: TeacherConversationResponse): BoardReply[] {
  return conversation.messages.map((message) => {
    const sentAt = toServerInstant(message.sentAt);
    const isParent = message.senderRole === 'PARENT';
    return {
      id: message.messageId,
      authorRole: isParent ? 'parent' : 'teacher',
      authorName: message.senderName,
      content: message.content,
      label: isParent ? '학부모 문의' : '선생님 답변',
      time: formatConversationTime(sentAt),
      sentAt,
      ...(isParent ? {} : { deliveryStatus: 'SENT_TO_PARENT' as const }),
    };
  });
}

function riskText(level: ApiRiskLevel | null | undefined, score: number | null | undefined) {
  if (!level) return null;
  const label = systemRiskLabel[systemRiskLevelFromApi[level]];
  return score == null ? label : `${label}(${score}점)`;
}

// GET /history is newest first; the inbox lists logs oldest first. Empty fields are omitted, not null.
export function toActivityLogs(events: HistoryEvent[]): ActivityLog[] {
  return [...events].reverse().map((event) => {
    const after = riskText(event.riskLevel, event.riskScore);
    const before = riskText(event.previousRiskLevel, event.previousRiskScore);
    const statusChange = event.newStatus
      ? `${event.previousStatus ? `${complaintStatusLabel[event.previousStatus]} → ` : ''}${complaintStatusLabel[event.newStatus]}`
      : null;
    const detail = [
      statusChange,
      after ? (before ? `${before} → ${after}` : after) : null,
      event.reason,
    ].filter(Boolean).join(' · ');
    return {
      id: event.eventId,
      time: formatMessageDate(toServerInstant(event.occurredAt)),
      // System events (e.g. RISK_ANALYZED) come with no actor or the actor name "SYSTEM".
      actor: !event.actorName || event.actorName === 'SYSTEM' ? '시스템' : event.actorName,
      action: historyEventLabel[event.type] ?? event.type,
      detail: detail || '-',
    };
  });
}

function toClassifications(risk: TeacherRiskResponse): RiskClassification[] {
  // detectedFactors holds only the tags the final analysis detected, so the rest are ABSENT, not unknown.
  const detected = new Map(risk.detectedFactors.map((factor) => [classificationCodeByTag[factor.code], factor]));
  return riskCategories.map(({ code }) => {
    const factor = detected.get(code);
    return factor
      ? { code, status: 'PRESENT', evidenceSpan: factor.evidence, rationale: factor.reason }
      : { code, status: 'ABSENT' };
  });
}

function toAnalysis(
  { conversation, detail, history, risk }: ServerThreadDetail,
  local: ThreadAnalysis | undefined,
): ThreadAnalysis {
  // Above LOW the server sends the latest parent message as a buffered summary.
  const summarized = [...conversation.messages].reverse().find((message) => message.senderRole === 'PARENT' && message.summarized);
  const base: ThreadAnalysis = {
    // Kept from the browser: the server has no AI objections or reviewer re-check requests.
    aiObjections: local?.aiObjections,
    riskReviewRequestedAt: local?.riskReviewRequestedAt,
    emergencyReview: local?.emergencyReview,
    activityLogs: toActivityLogs(history),
    canReviewRisk: detail.status === 'OPEN' && detail.waitingFor === 'TEACHER',
    canViewActivityLog: true,
    canViewOriginal: true,
    // The original is fetched on demand through POST /original-views.
    originalMessageAvailable: true,
    packageAvailable: conversation.allowedActions.includes('CREATE_EVIDENCE_PACKAGE'),
    riskFactors: [],
    safetyLock: risk?.safetyLock ?? false,
    studentSafetySignal: 'NONE',
    summary: { status: 'ready', text: summarized?.content ?? '' },
    systemRiskLevel: systemRiskLevelFromApi[risk?.riskLevel ?? detail.riskLevel ?? 'LOW'],
  };
  if (!risk) return { ...base, status: 'failed' };
  return {
    ...base,
    status: 'ready',
    riskClassifications: toClassifications(risk),
    // reviewScore falls back to the initial score for the analysed level, so it counts only with a review.
    ...(risk.latestReview ? {
      teacherReviewedRiskLevel: systemRiskLevelFromApi[risk.reviewLevel],
      teacherRiskScore: risk.reviewScore as RiskScore,
      teacherReviewReason: risk.latestReview.reason || undefined,
    } : {}),
  };
}

// Merges the opened thread's detail, conversation, risk, and history. Browser-local fields
// (pin, reply drafts, evidence package) are kept from the current thread.
export function mergeServerDetail(thread: BoardThread, bundle: ServerThreadDetail): BoardThread {
  const { detail, conversation } = bundle;
  const replies = toReplies(conversation);
  const latest = replies.at(-1);
  const hasTeacherReply = replies.some((reply) => reply.authorRole === 'teacher');
  const analysis = toAnalysis(bundle, thread.analysis);
  const level = analysis.teacherReviewedRiskLevel ?? analysis.systemRiskLevel;
  const latestAt = latest?.sentAt ?? thread.latestAt;
  const firstSentAt = replies[0]?.sentAt ?? toServerInstant(detail.submittedAt);
  return {
    ...thread,
    serverStatus: { status: detail.status, waitingFor: detail.waitingFor },
    title: detail.title,
    parentName: detail.parentName,
    studentName: detail.studentName,
    className: className(detail.grade, detail.classNo),
    replies,
    analysis,
    risk: systemRiskTone[level],
    latestAt,
    latestAtLabel: latestAt ? formatMessageDate(latestAt) : thread.latestAtLabel,
    messageDateLabel: firstSentAt ? formatConversationDate(firstSentAt) : thread.messageDateLabel,
    status: threadStatus(detail.status, detail.waitingFor, hasTeacherReply),
    // A follow-up after the teacher's reply puts it back on the teacher.
    needsTeacherReview: detail.waitingFor === 'TEACHER' && hasTeacherReply,
  };
}

// The thread shell while its detail is loading, so the risk tab shows the loading notice.
export function markServerDetailLoading(thread: BoardThread): BoardThread {
  if (thread.analysis) return thread;
  return {
    ...thread,
    analysis: {
      status: 'loading',
      activityLogs: [],
      canReviewRisk: false,
      canViewActivityLog: true,
      canViewOriginal: false,
      originalMessageAvailable: false,
      packageAvailable: false,
      riskFactors: [],
      safetyLock: false,
      studentSafetySignal: 'NONE',
      summary: { status: 'ready', text: '' },
      systemRiskLevel: systemRiskLevelFromApi[apiLevelOf(thread)],
    },
  };
}

function apiLevelOf(thread: BoardThread): ApiRiskLevel {
  const levelByTone = { normal: 'LOW', attention: 'MEDIUM', danger: 'HIGH', urgent: 'EMERGENCY' } as const;
  return levelByTone[thread.risk];
}

export type ServerInboxFilters = {
  query: string;
  risk: RiskFilterValue;
  sort: SortValue;
  status: FilterValue;
};

const statusQuery: Record<FilterValue, ComplaintStatus | undefined> = {
  active: 'OPEN',
  complete: 'CLOSED',
  all: undefined,
};

// The server sorts only by activity time; the inbox's risk and status sorts are browser-only.
export function toComplaintListQuery(filters: ServerInboxFilters, page: number): ComplaintListQuery {
  return {
    page,
    keyword: filters.query.trim() || undefined,
    status: statusQuery[filters.status],
    riskLevel: filters.risk === 'all' ? undefined : (filters.risk.toUpperCase() as ApiRiskLevel),
    sort: filters.sort === 'oldest' ? 'OLDEST' : 'LATEST',
  };
}
