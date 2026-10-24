import { formatMessageDate, getConversation } from '../parent-message/conversation';
import { mockConnectedTeachers, readSentMessages, updateSentMessage } from '../parent-message/messageDraft';
import type { BoardThread } from './types';

function readParentUserIds(): number[] {
  try {
    const ids: number[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const match = localStorage.key(index)?.match(/^teacher-hub\.parent-sent-messages\.(\d+)$/);
      if (match) ids.push(Number(match[1]));
    }
    return ids;
  } catch {
    // Blocked storage leaves only the built-in example threads.
    return [];
  }
}

// Browser-local mock bridge. A server API must enforce both the parent owner and assigned teacher.
export function readTeacherParentThreads(teacherUserId: number): BoardThread[] {
  const teachers = mockConnectedTeachers.filter((teacher) => teacher.userId === teacherUserId);
  const threads: BoardThread[] = [];
  for (const parentUserId of readParentUserIds()) {
    try {
      for (const message of readSentMessages(parentUserId)) {
        const teacher = teachers.find((item) => item.value === message.teacherId);
        if (!teacher) continue;
        const conversation = getConversation(message);
        const latest = conversation[conversation.length - 1];
        const parentName = message.parentName?.trim() || '학부모';
        threads.push({
          id: message.messageId, parentUserId, parentName, studentName: '', className: teacher.className,
          title: message.title, latestMessage: latest.body, latestAt: latest.sentAt, latestAtLabel: formatMessageDate(latest.sentAt),
          messageDateLabel: formatMessageDate(message.sentAt, false), originalMessage: message.finalBody,
          status: message.consultationStatus ?? 'before', needsTeacherReview: message.needsTeacherReview,
          teacherAcknowledgedAt: message.teacherAcknowledgedAt, risk: 'normal', riskReviewRequired: false,
          isPinned: message.teacherPinned ?? false, draftText: message.teacherDraftText ?? '', draftSavedAt: message.teacherDraftSavedAt,
          replies: conversation.map((entry) => ({
            id: entry.id, authorRole: entry.authorRole, authorName: entry.authorRole === 'teacher' ? message.teacherName : parentName,
            content: entry.body, label: entry.authorRole === 'teacher' ? '선생님 답변' : '학부모 문의', time: formatMessageDate(entry.sentAt), sentAt: entry.sentAt,
          })),
        });
      }
    } catch {
      // A damaged record belonging to another account must not prevent other threads from loading.
    }
  }
  return threads.sort((a, b) => b.latestAt.localeCompare(a.latestAt));
}

export function persistTeacherParentThread(teacherUserId: number, thread: BoardThread) {
  if (thread.parentUserId === undefined) return;
  updateSentMessage(thread.parentUserId, thread.id, (message) => {
    if (!mockConnectedTeachers.some((teacher) => teacher.userId === teacherUserId && teacher.value === message.teacherId)) {
      throw new Error('담당 교사만 문의를 처리할 수 있습니다.');
    }
    const existing = getConversation(message);
    const addedReplies = thread.replies.filter((reply) => reply.authorRole === 'teacher' && !existing.some((entry) => entry.id === reply.id));
    return {
      ...message,
      consultationStatus: thread.status,
      needsTeacherReview: thread.needsTeacherReview,
      teacherAcknowledgedAt: thread.teacherAcknowledgedAt,
      teacherDraftText: thread.draftText, teacherDraftSavedAt: thread.draftSavedAt, teacherPinned: thread.isPinned,
      conversation: [...existing, ...addedReplies.map((reply) => ({
        id: reply.id, authorRole: 'teacher' as const, body: reply.content, sentAt: reply.sentAt ?? thread.latestAt,
      }))],
      updatedAt: addedReplies.length > 0 ? thread.latestAt : message.updatedAt,
    };
  });
}
