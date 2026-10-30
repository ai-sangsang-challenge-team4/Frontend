import { ApiError, isAbortError, isApiError, toServerInstant } from '../../shared/api';
import type { DetectedFactorCode } from '../escalation/escalationTypes';
import { requireMaskedText } from '../pii/masking';
import { parentComplaintApi, type ComplaintRecipientResponse, type ParentFollowUpResponse, type RiskRevisionResponse, type RiskSummaryResponse } from './api/parentComplaintApi';
import { appendFollowUp, findSentSubmission } from './conversation';
import { storeSentMessage, type MessageDraft, type ServerComplaintDraft } from './messageDraft';
import { OFFICIAL_MEANING_WARNING } from './parentMessageApi';
import { getRiskTagNames, type RiskTagNames } from '../risk-analysis/riskTagCatalog';
import {
  getSelectedMessage,
  validateFinalMessage,
  type MessageReview,
  type ParentMessageAnalysis,
  type RiskExpression,
  type RiskExpressionKind,
  type SentParentMessage,
} from './parentMessageTypes';

// Parent inquiries against the backend (VITE_MESSAGE_API=http): server DRAFT → masking → analysis → findings
// → PATCH when the chosen text differs → send. Title and body go to the server masked, as in the mock flow,
// because the server stores the text as given and shows it to the teacher.

export type ServerChild = { studentId: number; studentName: string };

export type ServerRecipient = { teacherId: number; teacherName: string; label: string };

// The parent's linked children from GET /users/me. A parent without a linked child has none to choose.
export async function listServerChildren(signal?: AbortSignal): Promise<ServerChild[]> {
  const me = await parentComplaintApi.getMe(signal);
  return (me.students ?? []).map(({ studentId, name }) => ({ studentId, studentName: name }));
}

export function toServerRecipients(recipients: ComplaintRecipientResponse[]): ServerRecipient[] {
  return recipients.map(({ teacherId, teacherName, homeroomTeacher }) => ({
    teacherId, teacherName, label: `${teacherName} 선생님${homeroomTeacher ? ' (담임)' : ''}`,
  }));
}

// Local presentation kinds and fallback names when the risk-tag catalog is unavailable.
export const riskTags: Record<DetectedFactorCode, { kind: RiskExpressionKind; title: string }> = {
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
export function toServerAnalysis(revision: RiskRevisionResponse, maskedContent: string, tagNames: RiskTagNames = {}): ParentMessageAnalysis {
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
        title: tagNames[finding.code] ?? tag.title,
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
    revisionReason: revision.finalRevision?.reason?.trim() || null,
    risks,
    meaningWarning: revision.findings.some((finding) => finding.code === 'LEGAL') ? OFFICIAL_MEANING_WARNING : null,
  };
}

const failedAnalysis: ParentMessageAnalysis = { status: 'failed', revisedText: null, risks: [], meaningWarning: null };

// 409 on /risk-analysis when this message was already analyzed with other content: no new suggestions,
// and /send analyzes the final content instead.
const ANALYZE_ON_SUBMIT_CODES = new Set(['FINAL_ANALYSIS_ON_SUBMIT', 'REANALYSIS_LIMIT_REACHED']);

export type ServerDraftTarget = Pick<ServerComplaintDraft, 'studentId' | 'teacherId' | 'teacherName'> & {
  // Set when replying within an existing server complaint.
  complaintId?: number;
};

export function toFollowUpServerDraft(draft: MessageDraft, target: ServerDraftTarget, response: ParentFollowUpResponse): ServerComplaintDraft {
  return {
    studentId: target.studentId, teacherId: target.teacherId, teacherName: target.teacherName,
    complaintId: response.complaintId, serverMessageId: response.messageId,
    title: requireMaskedText(draft.title.trim()), content: response.content,
    contentVersion: response.contentVersion, analysisId: null,
  };
}

const DRAFT_CONFLICT_MESSAGE = '다른 기기나 탭에서 서버의 추가 문의 초안이 변경되었습니다. 작성한 내용은 유지됩니다. 서버 초안을 불러와 확인해 주세요.';

function draftConflict(): never {
  throw new ApiError({ code: 'PARENT_DRAFT_CONFLICT', status: 409, message: DRAFT_CONFLICT_MESSAGE });
}

// The server rejects a stale expectedContentVersion with 409 CONTENT_VERSION_CONFLICT (also when it is
// missing); the composer offers the server draft for that code, as for the conflicts found here.
async function withDraftConflict<T>(request: Promise<T>) {
  try {
    return await request;
  } catch (error) {
    if (isApiError(error) && error.code === 'CONTENT_VERSION_CONFLICT') draftConflict();
    throw error;
  }
}

// The version the parent last saw. Drafts stored before contentVersion was kept read it once from the server.
async function knownFollowUpVersion(server: ServerComplaintDraft, signal: AbortSignal) {
  if (server.contentVersion !== undefined) return server.contentVersion;
  const current = await parentComplaintApi.getFollowUpDraft(server.complaintId, signal);
  if (!current || current.messageId !== server.serverMessageId || current.content !== server.content) draftConflict();
  return current.contentVersion;
}

// Saved even when unchanged: the server keeps the version for the same content but still checks it, so a draft
// changed on another device is caught before analysis. A conflict whose server draft already holds this content
// is a retry after a lost save response, so that draft is used.
async function updateFollowUp(server: ServerComplaintDraft, content: string, signal: AbortSignal) {
  const expectedContentVersion = await knownFollowUpVersion(server, signal);
  try {
    return await parentComplaintApi.saveFollowUpDraft(server.complaintId, { content, expectedContentVersion }, signal);
  } catch (error) {
    if (!isApiError(error) || error.code !== 'CONTENT_VERSION_CONFLICT') throw error;
    const current = await parentComplaintApi.getFollowUpDraft(server.complaintId, signal);
    if (current && current.messageId === server.serverMessageId && current.content === content) return current;
    draftConflict();
  }
}

// Not abortable: a server draft created after the parent left the analysis would otherwise stay on the server
// unlinked (there is no delete API), so the caller keeps the result even when it no longer waits for it.
export async function createServerDraft(draft: MessageDraft, target: ServerDraftTarget): Promise<ServerComplaintDraft> {
  const title = requireMaskedText(draft.title.trim());
  const content = requireMaskedText(draft.body.trim());
  const { studentId, teacherId, teacherName } = target;
  if (draft.threadId) {
    if (!target.complaintId) throw new Error('기존 문의의 서버 정보를 확인하지 못했습니다.');
    const existing = await parentComplaintApi.getFollowUpDraft(target.complaintId);
    if (existing && existing.content !== content) draftConflict();
    const saved = existing ?? await withDraftConflict(parentComplaintApi.saveFollowUpDraft(target.complaintId, { content }));
    return toFollowUpServerDraft(draft, target, saved);
  }
  if (!studentId) throw new Error('문의할 자녀를 선택해 주세요.');
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
  } else if (server.content !== content && server.serverMessageId === undefined) {
    await parentComplaintApi.updateDraft(server.complaintId, { content }, signal);
    server = { ...server, content };
    persist(server);
  }

  if (server.serverMessageId !== undefined) {
    const saved = await updateFollowUp(server, content, signal);
    server = { ...server, content: saved.content, contentVersion: saved.contentVersion };
    persist(server);
  }

  // /mask addresses the initial draft only. Additional-message analysis masks its own draft on the server.
  const masking = server.serverMessageId === undefined ? await parentComplaintApi.mask(server.complaintId, signal) : null;
  const maskedContent = requireMaskedText(masking?.maskedContent ?? content);
  let summary: RiskSummaryResponse;
  try {
    summary = server.serverMessageId === undefined
      ? await parentComplaintApi.analyze(server.complaintId, signal)
      : await parentComplaintApi.analyzeFollowUp(server.complaintId, server.serverMessageId, signal);
  } catch (error) {
    if (isApiError(error) && ANALYZE_ON_SUBMIT_CODES.has(error.code)) {
      return { server, analysis: {
        ...failedAnalysis, status: 'ready', analyzeOnSubmit: true, maskedContent,
        ...(masking ? { maskingContentVersion: masking.contentVersion } : {}),
      } };
    }
    throw error;
  }
  const { analysisId } = summary;
  server = { ...server, analysisId, ...(masking ? { contentVersion: masking.contentVersion } : {}) };
  persist(server);

  const metadata = {
    riskSummary: { riskScore: summary.riskScore, riskLevel: summary.riskLevel },
    maskedContent,
    ...(masking ? { maskingContentVersion: masking.contentVersion } : {}),
  };
  try {
    const [findings, tagNames] = await Promise.all([
      parentComplaintApi.getFindings(analysisId, signal), getRiskTagNames(signal),
    ]);
    return { server, analysis: { ...toServerAnalysis(findings, maskedContent, tagNames), ...metadata } };
  } catch (error) {
    if (signal.aborted || isAbortError(error)) throw error;
    // The analysis is stored, so the parent can still send; only the suggestions are missing.
    return { server, analysis: { ...failedAnalysis, ...metadata } };
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
  onServerDraftUpdate?: (server: ServerComplaintDraft) => void,
): Promise<SentParentMessage> {
  const existing = findSentSubmission(userId, draft, review);
  if (existing) return existing;
  if (findSentSubmission(userId, draft, null)) {
    throw new ApiError({ code: 'PARENT_MESSAGE_CONTENT_MISMATCH', status: 409,
      message: '이 메시지는 다른 문장으로 이미 전송되었습니다. 현재 작성한 내용은 유지됩니다. 문의 내역을 확인해 주세요.' });
  }
  let server = draft.server;
  if (!server) throw new Error('AI 분석을 먼저 진행해 주세요.');
  const selected = getSelectedMessage(draft.body, review);
  const validation = validateFinalMessage(selected.text);
  if (validation) throw new Error(validation);
  const content = requireMaskedText(selected.text.trim());
  const originalBody = requireMaskedText(draft.body);

  let sentAt = new Date().toISOString();
  try {
    if (server.serverMessageId !== undefined) {
      const messageId = server.serverMessageId;
      const saved = await updateFollowUp(server, content, signal);
      server = { ...server, content: saved.content, contentVersion: saved.contentVersion };
      onServerDraftUpdate?.(server);
      const sent = await withDraftConflict(parentComplaintApi.submitFollowUp(
        server.complaintId, messageId, { expectedContentVersion: saved.contentVersion }, signal,
      ));
      if (sent.messageId !== messageId || sent.content !== content) {
        throw new ApiError({ code: 'PARENT_MESSAGE_CONTENT_MISMATCH', status: 409,
          message: '서버에 전송된 내용이 확인한 문장과 다릅니다. 문의 내역을 다시 확인해 주세요.' });
      }
      sentAt = toServerInstant(sent.sentAt) ?? sentAt;
    } else {
      if (content !== server.content) {
        await parentComplaintApi.updateDraft(server.complaintId, { content }, signal);
        server = { ...server, content };
        onServerDraftUpdate?.(server);
      }
      await parentComplaintApi.submit(server.complaintId, signal);
    }
  } catch (error) {
    if (signal.aborted || isAbortError(error)) throw error;
    if (server.serverMessageId !== undefined) {
      const messageId = server.serverMessageId;
      // After a lost send response, only this exact message proves the request succeeded.
      const conversation = await parentComplaintApi.getConversation(server.complaintId, signal).catch(() => null);
      const sent = conversation?.messages.find((message) => message.messageId === messageId && message.status !== 'DRAFT' && message.content === content);
      if (!sent) throw error;
      sentAt = toServerInstant(sent.sentAt) ?? sentAt;
    } else if (!await wasSubmitted(server.complaintId, error, signal)) throw error;
  }

  const message: SentParentMessage = {
    parentName,
    messageId: draft.messageId,
    serverComplaintId: server.complaintId,
    ...(server.serverMessageId !== undefined ? { serverMessageId: server.serverMessageId } : {}),
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
    return draft.threadId ? appendFollowUp(userId, draft, message) : storeSentMessage(userId, message);
  } catch {
    if (draft.threadId) throw new Error('전송은 완료됐지만 문의 내역에 저장하지 못했습니다. 작성한 내용은 유지됩니다. 다시 시도해 주세요.');
    // The server already has the inquiry; only the local copy is missing.
    return message;
  }
}
