import { toServerInstant } from '../../shared/api';
import { formatMessageDate } from '../parent-message/conversation';
import type {
  ResponseTemplateAdoptionRequest,
  ResponseTemplateResponse,
  TeacherResponseDraftResponse,
  TeacherResponseSubmissionResponse,
} from './api/teacherInboxTypes';
import { formatConversationTime } from './messageDates';
import { canUseOfficialReplyTemplate } from './messageRules';
import { getReplyDraftTab, selectReplyDraft } from './replyDrafts';
import { findReplyTemplate, type ReplyTemplate, type ReplyTemplateDraft } from './replyTemplates';
import { threadStatus } from './serverThreads';
import type { BoardThread, ReplyDraftState, ReplyDraftTab } from './types';

// The server keeps one reply draft per complaint, while the composer keeps one per tab (AI, manual,
// the High template on the AI tab). Saving sends the current tab only; the other tabs stay in the browser.

// The server accepts drafts and replies only while the complaint is OPEN and waiting for the teacher
// (409 RESPONSE_NOT_EDITABLE otherwise). Local threads have no such state.
export function getServerReplyBlockReason(thread: BoardThread) {
  const state = thread.serverStatus;
  if (!state || (state.status === 'OPEN' && state.waitingFor === 'TEACHER')) return null;
  return state.status === 'CLOSED' || state.waitingFor === 'NONE'
    ? '완료된 상담이라 답변을 작성하거나 보낼 수 없습니다.'
    : '학부모의 답장을 기다리는 중이라 지금은 답변을 보낼 수 없습니다.';
}

// POST /close accepts only a complaint the teacher has answered and that now waits for the parent.
export function getServerCloseBlockReason(thread: BoardThread) {
  const state = thread.serverStatus;
  if (!state) return null;
  if (state.status === 'CLOSED' || state.waitingFor === 'NONE') return '이미 완료된 상담입니다.';
  if (state.waitingFor === 'TEACHER') return '답변을 보낸 뒤에 상담을 완료할 수 있습니다.';
  return null;
}

// Labels for the seeded HIGH_ACKNOWLEDGEMENT variables; an unknown variable shows its own name.
const serverTemplateVariableLabels: Record<string, string> = {
  parentName: '보호자 호칭',
  issueSummary: '문의 내용',
  nextAction: '진행 중인 절차',
  contactPlan: '안내 방법',
};

// A server template is one sentence block with the teacher's variables; the server renders it again on
// POST /adoptions, so the wording outside the variables cannot change.
export function toServerReplyTemplate(response: ResponseTemplateResponse): ReplyTemplate {
  return {
    approved: true,
    blocks: [{ blockId: 'content', kind: 'ACKNOWLEDGE', mode: 'VARIABLE_ONLY', text: response.contentTemplate }],
    description: `${response.code} v${response.version}`,
    matchFactorIds: [],
    serverVersionId: response.versionId,
    status: 'ACTIVE',
    teacherVariables: Object.fromEntries(response.requiredVariables.map((key) => [
      key,
      serverTemplateVariableLabels[key] ?? key,
    ])),
    templateId: `server-template:${response.versionId}`,
    title: response.name,
    version: response.version,
  };
}

// Only the template's own variables go to POST /adoptions.
export function toTemplateAdoptionRequest(
  template: ReplyTemplate,
  draft: ReplyTemplateDraft,
  finalContent: string,
): ResponseTemplateAdoptionRequest {
  return {
    variables: Object.fromEntries(Object.keys(template.teacherVariables ?? {}).map((key) => [
      key,
      (draft.variables[key] ?? '').trim(),
    ])),
    finalContent,
  };
}

export function formatServerSavedAt(value: string) {
  return formatMessageDate(toServerInstant(value));
}

// Writes one tab's draft whether or not it is the tab on screen.
export function setReplyDraftTabState(thread: BoardThread, tab: ReplyDraftTab, state: ReplyDraftState): BoardThread {
  if (getReplyDraftTab(thread) === tab) {
    return { ...thread, ...state, replyDraftTab: tab };
  }
  return { ...thread, replyDrafts: { ...thread.replyDrafts, [tab]: state } };
}

function hasLocalDraft(thread: BoardThread) {
  return Boolean(thread.draftText.trim() || thread.appliedTemplate) ||
    Object.values(thread.replyDrafts ?? {}).some((draft) => Boolean(draft?.draftText.trim() || draft?.appliedTemplate));
}

// Plain text cannot be turned back into the High template's blocks, and the manual tab is closed there.
export function canRestoreServerDraft(thread: BoardThread) {
  return !thread.appliedTemplate && !(canUseOfficialReplyTemplate(thread) && findReplyTemplate(thread));
}

// The saved server draft continues on the manual tab, like a reply written before the tabs existed.
// Drafts already in the browser are newer than the server copy and win.
export function shouldRestoreServerDraft(thread: BoardThread, draft: TeacherResponseDraftResponse | null) {
  return Boolean(draft?.content.trim()) && !hasLocalDraft(thread) && canRestoreServerDraft(thread);
}

export function restoreServerDraft(thread: BoardThread, draft: TeacherResponseDraftResponse | null): BoardThread {
  const checked = { ...thread, serverDraftChecked: true };
  if (!draft || !shouldRestoreServerDraft(thread, draft)) return checked;
  return {
    ...selectReplyDraft(checked, 'manual'),
    draftText: draft.content,
    draftSavedAt: formatServerSavedAt(draft.updatedAt),
  };
}

// After PUT /response-draft the saved tab is the server copy, and only while it still holds the saved text;
// any other tab's "saved" mark would be stale. The saved tab may no longer be on screen.
export function markServerDraftSaved(
  thread: BoardThread,
  draft: TeacherResponseDraftResponse,
  savedTab: ReplyDraftTab = getReplyDraftTab(thread),
  content = thread.draftText.trim(),
): BoardThread {
  const savedAt = formatServerSavedAt(draft.updatedAt);
  const activeTab = getReplyDraftTab(thread);
  const markFor = (tab: string, text: string) => tab === savedTab && text.trim() === content ? savedAt : undefined;
  const replyDrafts = Object.fromEntries(
    Object.entries(thread.replyDrafts ?? {}).map(([tab, state]) => [
      tab,
      // The active tab's live state is on the thread itself.
      tab === activeTab || !state ? state : { ...state, draftSavedAt: markFor(tab, state.draftText) },
    ]),
  ) as BoardThread['replyDrafts'];
  return { ...thread, replyDrafts, draftSavedAt: markFor(activeTab, thread.draftText) };
}

// Shows the sent reply right away; the following detail reload brings the server's conversation and history.
// The reply id matches the conversation's "message:{id}".
export function applyServerSubmission(
  thread: BoardThread,
  response: TeacherResponseSubmissionResponse,
  authorName: string,
): BoardThread {
  const sentAt = toServerInstant(response.sentAt) ?? new Date().toISOString();
  return {
    ...thread,
    aiDraftGenerated: false,
    appliedTemplate: undefined,
    draftSavedAt: undefined,
    draftText: '',
    officialTemplateApplied: false,
    replyDraftTab: undefined,
    replyDrafts: undefined,
    serverStatus: { status: response.complaintStatus, waitingFor: response.waitingFor },
    status: threadStatus(response.complaintStatus, response.waitingFor, true),
    needsTeacherReview: false,
    latestAt: sentAt,
    latestAtLabel: formatMessageDate(sentAt),
    latestMessage: response.content,
    analysis: thread.analysis ? { ...thread.analysis, canReviewRisk: false } : thread.analysis,
    replies: [
      ...thread.replies,
      {
        id: `message:${response.responseId}`,
        authorName,
        authorRole: 'teacher',
        content: response.content,
        deliveryStatus: 'SENT_TO_PARENT',
        label: '선생님 답변',
        readByParent: false,
        time: formatConversationTime(sentAt),
        sentAt,
      },
    ],
  };
}
