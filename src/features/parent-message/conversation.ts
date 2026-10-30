import { findSentMessage, readSentMessages, updateSentMessage, type MessageDraft } from './messageDraft';
import { getSelectedMessage, maskContactInfo, type ConversationMessage, type MessageReview, type SentParentMessage } from './parentMessageTypes';

export const consultationLabels = { before: '상담 전', inProgress: '상담 중', complete: '상담 완료' };
export const consultationChips = { before: 'pending', inProgress: 'progress', complete: 'complete' } as const;

export function getConversation(message: SentParentMessage): ConversationMessage[] {
  return message.conversation?.length ? message.conversation : [{
    id: message.messageId, authorRole: 'parent', body: message.finalBody, sentAt: message.sentAt,
  }];
}

export function formatMessageDate(at: string, includeTime = true) {
  return new Date(at).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } as const : {}),
  });
}

export function formatHistoryTime(at: string) {
  const date = new Date(at);
  const dateOptions = { timeZone: 'Asia/Seoul', year: 'numeric', month: 'numeric', day: 'numeric' } as const;
  return date.toLocaleDateString('ko-KR', dateOptions) === new Date().toLocaleDateString('ko-KR', dateOptions)
    ? date.toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric' });
}

// Compares ISO timestamps chronologically so records with different UTC offsets still order correctly.
export function compareMessageTimes(left: string, right: string) {
  return Date.parse(left) - Date.parse(right);
}

// Parent-side recheck: the teacher replied after the parent's last message and the parent has not confirmed it yet.
export function needsParentReview(message: SentParentMessage) {
  const conversation = getConversation(message);
  // The server list reports a teacher reply (waiting on the parent) before its conversation is loaded.
  if (message.serverWaitingFor === 'PARENT' && message.consultationStatus !== 'complete' &&
    conversation.at(-1)?.authorRole === 'parent') return true;
  const latestTeacherReply = conversation.filter((entry) => entry.authorRole === 'teacher').at(-1);
  const latestParentMessage = conversation.filter((entry) => entry.authorRole === 'parent').at(-1);
  if (!latestTeacherReply || (latestParentMessage && compareMessageTimes(latestParentMessage.sentAt, latestTeacherReply.sentAt) > 0)) return false;
  return !message.parentAcknowledgedAt || compareMessageTimes(message.parentAcknowledgedAt, latestTeacherReply.sentAt) < 0;
}

export function getDraftPath(draft: MessageDraft) {
  return draft.threadId
    ? `/parent/messages/${encodeURIComponent(draft.threadId)}/follow-up?draft=${encodeURIComponent(draft.messageId)}`
    : `/parent/messages/new?draft=${encodeURIComponent(draft.messageId)}`;
}

// null checks only identity, allowing callers to distinguish an already-sent message with different text.
export function findSentSubmission(userId: number, draft: MessageDraft, review: MessageReview | null | undefined = draft.review) {
  const thread = findSentMessage(userId, draft.threadId ?? draft.messageId);
  const remoteId = thread?.serverComplaintId === draft.server?.complaintId ? draft.server?.serverMessageId : undefined;
  const expectedBody = review ? maskContactInfo(getSelectedMessage(draft.body, review).text.trim()).text : null;
  return thread && (!draft.threadId ? expectedBody === null || thread.finalBody === expectedBody
    : getConversation(thread).some((entry) => entry.authorRole === 'parent' &&
      (entry.id === draft.messageId || (remoteId !== undefined && entry.serverMessageId === remoteId)) &&
      (expectedBody === null || entry.body === expectedBody))) ? thread : null;
}

export function findSentSubmissionById(userId: number, submissionId: string) {
  return readSentMessages(userId).find((thread) => thread.messageId === submissionId ||
    getConversation(thread).some((entry) => entry.authorRole === 'parent' && entry.id === submissionId)) ?? null;
}

export function appendFollowUp(userId: number, draft: MessageDraft, submission: SentParentMessage) {
  return updateSentMessage(userId, draft.threadId!, (thread) => {
    if (getConversation(thread).some((entry) => entry.id === draft.messageId ||
      (thread.serverComplaintId === submission.serverComplaintId && submission.serverMessageId !== undefined &&
        entry.authorRole === 'parent' && entry.serverMessageId === submission.serverMessageId))) return thread;
    if (thread.teacherId !== draft.teacherId || thread.title !== draft.title) throw new Error('기존 문의 정보를 다시 확인해 주세요.');
    const isComplete = thread.consultationStatus === 'complete';
    return {
      ...thread,
      parentName: thread.parentName ?? submission.parentName,
      conversation: [...getConversation(thread), {
        id: submission.messageId, authorRole: 'parent', body: submission.finalBody, sentAt: submission.sentAt,
        ...(submission.serverMessageId !== undefined ? { serverMessageId: submission.serverMessageId } : {}),
      }],
      updatedAt: submission.sentAt,
      consultationStatus: isComplete ? 'inProgress' : thread.consultationStatus ?? 'before',
      // Only a follow-up on a completed consultation asks the teacher to recheck; an open flag stays until the teacher replies.
      needsTeacherReview: isComplete || thread.needsTeacherReview,
      auditLog: [...thread.auditLog, ...submission.auditLog],
    };
  });
}
