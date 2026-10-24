import { findSentMessage, readSentMessages, updateSentMessage, type MessageDraft } from './messageDraft';
import type { ConversationMessage, SentParentMessage } from './parentMessageTypes';

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

export function getDraftPath(draft: MessageDraft) {
  return draft.threadId
    ? `/parent/messages/${encodeURIComponent(draft.threadId)}/follow-up?draft=${encodeURIComponent(draft.messageId)}`
    : `/parent/messages/new?draft=${encodeURIComponent(draft.messageId)}`;
}

export function findSentSubmission(userId: number, draft: MessageDraft) {
  const thread = findSentMessage(userId, draft.threadId ?? draft.messageId);
  return thread && (!draft.threadId || getConversation(thread).some((entry) => entry.id === draft.messageId)) ? thread : null;
}

export function findSentSubmissionById(userId: number, submissionId: string) {
  return readSentMessages(userId).find((thread) => thread.messageId === submissionId ||
    getConversation(thread).some((entry) => entry.authorRole === 'parent' && entry.id === submissionId)) ?? null;
}

export function appendFollowUp(userId: number, draft: MessageDraft, submission: SentParentMessage) {
  return updateSentMessage(userId, draft.threadId!, (thread) => {
    if (getConversation(thread).some((entry) => entry.id === draft.messageId)) return thread;
    if (thread.teacherId !== draft.teacherId || thread.title !== draft.title) throw new Error('기존 문의 정보를 다시 확인해 주세요.');
    return {
      ...thread,
      parentName: thread.parentName ?? submission.parentName,
      conversation: [...getConversation(thread), {
        id: submission.messageId, authorRole: 'parent', body: submission.finalBody, sentAt: submission.sentAt,
      }],
      updatedAt: submission.sentAt,
      consultationStatus: thread.consultationStatus === 'complete' ? 'inProgress' : thread.consultationStatus ?? 'before',
      needsTeacherReview: true,
      auditLog: [...thread.auditLog, ...submission.auditLog],
    };
  });
}
