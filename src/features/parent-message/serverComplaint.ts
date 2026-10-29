import { isAbortError, isApiError } from '../../shared/api';
import type { DetectedFactorCode } from '../escalation/escalationTypes';
import { requireMaskedText } from '../pii/masking';
import { parentComplaintApi, type ComplaintRecipientResponse, type RiskRevisionResponse } from './api/parentComplaintApi';
import { findSentSubmission } from './conversation';
import { storeSentMessage, type MessageDraft, type ServerComplaintDraft } from './messageDraft';
import { OFFICIAL_MEANING_WARNING } from './parentMessageApi';
import {
  getSelectedMessage,
  validateFinalMessage,
  type MessageReview,
  type ParentMessageAnalysis,
  type RiskExpression,
  type RiskExpressionKind,
  type SentParentMessage,
} from './parentMessageTypes';

// The parent's new inquiry against the backend (VITE_MESSAGE_API=http): server DRAFT → analysis → findings
// → PATCH when the chosen text differs → send. Title and body go to the server masked, as in the mock flow,
// because the server stores the text as given and shows it to the teacher.

export type ServerChild = { studentId: number; studentName: string };

export type ServerRecipient = { teacherId: number; teacherName: string; label: string };

// Stops a runaway loop if hasNext never turns false.
const MAX_COMPLAINT_PAGES = 20;

// There is no children API yet, so the children come from the parent's own complaints (studentId and
// studentName on each). A parent without any complaint has no child to choose. Replace this with the
// children endpoint once the backend adds it.
export async function listServerChildren(signal?: AbortSignal): Promise<ServerChild[]> {
  const children = new Map<number, string>();
  for (let page = 0; page < MAX_COMPLAINT_PAGES; page += 1) {
    const result = await parentComplaintApi.listComplaints(page, signal);
    for (const item of result.content) {
      if (!children.has(item.studentId)) children.set(item.studentId, item.studentName);
    }
    if (!result.hasNext) break;
  }
  return [...children].map(([studentId, studentName]) => ({ studentId, studentName }));
}

export function toServerRecipients(recipients: ComplaintRecipientResponse[]): ServerRecipient[] {
  return recipients.map(({ teacherId, teacherName, homeroomTeacher }) => ({
    teacherId, teacherName, label: `${teacherName} 선생님${homeroomTeacher ? ' (담임)' : ''}`,
  }));
}

// Names follow the backend risk_tags seed (GET /risk-tags).
const riskTags: Record<DetectedFactorCode, { kind: RiskExpressionKind; title: string }> = {
  PROFANITY: { kind: 'profanity', title: '욕설' },
  INSULT: { kind: 'insult', title: '인격 모욕' },
  THREAT: { kind: 'threat', title: '위험·협박' },
  LEGAL: { kind: 'official', title: '법적 조치 언급' },
  EXPOSURE: { kind: 'exposure', title: '공개·유포 위험' },
  REPEAT: { kind: 'repeat', title: '반복 민원' },
  UNFAIR_REQUEST: { kind: 'demand', title: '부당 요구' },
  PRIVACY: { kind: 'privacy', title: '개인정보 위험' },
};

const DEFAULT_RISK_EXPLANATION = '상대에게 부담이나 오해를 줄 수 있는 표현입니다. 전달하려는 내용이 객관적으로 드러나는지 확인해 주세요.';

// The server joins a tag's evidence lines into one originalExpression ("rule\nllm"), so a suggestion covers
// every evidence line it contains.
function expressionLines(text: string) {
  return text.split('\n').map((line) => line.trim()).filter(Boolean);
}

// One expression per evidence line, plus suggestion lines that are not among the evidence.
export function toServerAnalysis(revision: RiskRevisionResponse, maskedContent: string): ParentMessageAnalysis {
  const risks: RiskExpression[] = revision.findings.flatMap((finding) => {
    const tag = riskTags[finding.code];
    if (!tag) return [];
    const excerpts = [...new Set([
      ...finding.evidences.flatMap(expressionLines),
      ...finding.revisionSuggestions.flatMap((suggestion) => expressionLines(suggestion.originalExpression)),
    ])];
    return (excerpts.length > 0 ? excerpts : ['']).map((excerpt, index) => {
      const suggestion = finding.revisionSuggestions.find((item) => expressionLines(item.originalExpression).includes(excerpt))
        ?? (excerpts.length <= 1 ? finding.revisionSuggestions[0] : undefined);
      return {
        id: `${finding.code}-${index}`,
        kind: tag.kind,
        title: tag.title,
        excerpt,
        explanation: suggestion?.reason.trim() || DEFAULT_RISK_EXPLANATION,
        ...(suggestion?.suggestedExpression.trim() ? { suggestion: suggestion.suggestedExpression.trim() } : {}),
      };
    });
  });
  const revised = revision.finalRevision?.content.trim() || null;
  return {
    status: 'ready',
    revisedText: revised && revised !== maskedContent ? revised : null,
    risks,
    meaningWarning: revision.findings.some((finding) => finding.code === 'LEGAL') ? OFFICIAL_MEANING_WARNING : null,
  };
}

const failedAnalysis: ParentMessageAnalysis = { status: 'failed', revisedText: null, risks: [], meaningWarning: null };

// 409 on /risk-analysis when this message was already analyzed with other content: no new suggestions,
// and /send analyzes the final content instead.
const ANALYZE_ON_SUBMIT_CODES = new Set(['FINAL_ANALYSIS_ON_SUBMIT', 'REANALYSIS_LIMIT_REACHED']);

export type ServerDraftTarget = Pick<ServerComplaintDraft, 'studentId' | 'teacherId' | 'teacherName'>;

// Not abortable: a server draft created after the parent left the analysis would otherwise stay on the server
// unlinked (there is no delete API), so the caller keeps the result even when it no longer waits for it.
export async function createServerDraft(draft: MessageDraft, target: ServerDraftTarget): Promise<ServerComplaintDraft> {
  const title = requireMaskedText(draft.title.trim());
  const content = requireMaskedText(draft.body.trim());
  const { studentId, teacherId, teacherName } = target;
  const created = await parentComplaintApi.createDraft({ studentId, teacherId, title, content });
  return { studentId, teacherId, teacherName, complaintId: created.complaintId, title, content, analysisId: null };
}

// Creates or updates the server draft and analyzes it. `persist` receives every server state change so a
// retry after a later failure reuses the same server draft instead of creating another one.
export async function analyzeServerDraft(
  draft: MessageDraft,
  target: ServerDraftTarget,
  persist: (server: ServerComplaintDraft) => void,
  signal: AbortSignal,
): Promise<{ server: ServerComplaintDraft; analysis: ParentMessageAnalysis }> {
  const content = requireMaskedText(draft.body.trim());
  let server = draft.server;
  if (!server) {
    server = await createServerDraft(draft, target);
    persist(server);
    signal.throwIfAborted();
  } else if (server.content !== content) {
    await parentComplaintApi.updateDraft(server.complaintId, { content }, signal);
    server = { ...server, content };
    persist(server);
  }

  let analysisId: number;
  try {
    ({ analysisId } = await parentComplaintApi.analyze(server.complaintId, signal));
  } catch (error) {
    if (isApiError(error) && ANALYZE_ON_SUBMIT_CODES.has(error.code)) {
      return { server, analysis: { ...failedAnalysis, status: 'ready', analyzeOnSubmit: true } };
    }
    throw error;
  }
  server = { ...server, analysisId };
  persist(server);

  try {
    return { server, analysis: toServerAnalysis(await parentComplaintApi.getFindings(analysisId, signal), content) };
  } catch (error) {
    if (signal.aborted || isAbortError(error)) throw error;
    // The analysis is stored, so the parent can still send; only the suggestions are missing.
    return { server, analysis: failedAnalysis };
  }
}

// A retry after a lost response finds the complaint already submitted; the status tells it apart from a
// draft that cannot be submitted.
async function wasSubmitted(complaintId: number, error: unknown, signal: AbortSignal) {
  if (!isApiError(error) || error.code !== 'COMPLAINT_NOT_DRAFT') return false;
  const { status } = await parentComplaintApi.getStatus(complaintId, signal);
  return status !== 'DRAFT';
}

// Stores the chosen text on the server draft when it changed, submits it, and keeps a local copy for the
// receipt and history screens, which still read browser storage.
export async function submitServerDraft(
  userId: number,
  draft: MessageDraft,
  review: MessageReview,
  signal: AbortSignal,
  parentName?: string,
): Promise<SentParentMessage> {
  const existing = findSentSubmission(userId, draft);
  if (existing) return existing;
  const server = draft.server;
  if (!server) throw new Error('AI 분석을 먼저 진행해 주세요.');
  const selected = getSelectedMessage(draft.body, review);
  const validation = validateFinalMessage(selected.text);
  if (validation) throw new Error(validation);
  const content = requireMaskedText(selected.text.trim());
  const originalBody = requireMaskedText(draft.body);

  try {
    if (content !== server.content) await parentComplaintApi.updateDraft(server.complaintId, { content }, signal);
    await parentComplaintApi.submit(server.complaintId, signal);
  } catch (error) {
    if (signal.aborted || isAbortError(error) || !await wasSubmitted(server.complaintId, error, signal)) throw error;
  }

  const sentAt = new Date().toISOString();
  const message: SentParentMessage = {
    parentName,
    messageId: draft.messageId,
    serverComplaintId: server.complaintId,
    teacherId: String(server.teacherId),
    teacherName: server.teacherName,
    title: server.title,
    originalBody,
    finalBody: content,
    selectionType: selected.selectionType,
    selectionSource: review.source,
    status: 'SENT',
    sentAt,
    auditLog: [{ action: 'SENT', at: sentAt, selectionType: selected.selectionType }],
    consultationStatus: 'before',
  };
  try {
    return storeSentMessage(userId, message);
  } catch {
    // The server already has the inquiry; only the local copy is missing.
    return message;
  }
}
