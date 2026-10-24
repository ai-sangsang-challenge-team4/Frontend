import { formatMessageDate, getConversation } from '../parent-message/conversation';
import { mockConnectedTeachers, readSentMessages, updateSentMessage } from '../parent-message/messageDraft';
import type { ConversationMessage } from '../parent-message/parentMessageTypes';
import type { BoardThread, ConversationSummary } from './types';
import { isReplyTemplateDraft } from './replyTemplates';

const mockSummaryRules = [
  { keywords: ['상담 일정', '상담을 요청', '상담 가능'], text: '상담 일정 조율' },
  { keywords: ['진행된 사항', '조치', '확인되거나'], text: '진행 상황 안내' },
  { keywords: ['출결', '결석', '지각'], text: '출결 처리 기준 확인' },
  { keywords: ['준비물'], text: '준비물 안내' },
  { keywords: ['친구', '갈등', '다툼'], text: '교우 관계 상황 확인' },
  { keywords: ['급식'], text: '급식 관련 안내' },
];

function withObjectParticle(word: string) {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return `${word}${code >= 0 && code <= 11171 && code % 28 !== 0 ? '을' : '를'}`;
}

// Mock until the analysis API returns a conversation summary.
function createMockConversationSummary(title: string, conversation: ConversationMessage[]): ConversationSummary {
  const parentText = conversation.filter((entry) => entry.authorRole === 'parent').map((entry) => entry.body).join(' ');
  const requests = mockSummaryRules.filter((rule) => rule.keywords.some((keyword) => parentText.includes(keyword))).map((rule) => rule.text);
  const followUps = conversation.filter((entry) => entry.authorRole === 'parent').length - 1;
  const text = requests.length > 0 ? `${withObjectParticle(requests.join(', '))} 요청함.` : `${title}에 대해 문의함.`;
  return { topic: title, text: followUps > 0 ? `${text} 추가 문의 ${followUps}건 포함.` : text };
}

// The date chip shows the first day, so replies on that day show only the time.
function formatReplyTime(at: string, threadStartedAt: string) {
  const time = new Date(at).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: 'numeric', minute: '2-digit' });
  if (formatMessageDate(at, false) === formatMessageDate(threadStartedAt, false)) return time;
  return `${new Date(at).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric' })} ${time}`;
}

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
          conversationSummary: createMockConversationSummary(message.title, conversation),
          id: message.messageId, parentUserId, parentName, studentName: '', className: teacher.className,
          title: message.title, latestMessage: latest.body, latestAt: latest.sentAt, latestAtLabel: formatMessageDate(latest.sentAt),
          messageDateLabel: formatMessageDate(message.sentAt, false), originalMessage: message.finalBody,
          status: message.consultationStatus ?? 'before', needsTeacherReview: message.needsTeacherReview,
          parentAcknowledgedAt: message.parentAcknowledgedAt, activityLogs: message.activityLogs ?? [], risk: 'normal', riskReviewRequired: false,
          isPinned: message.teacherPinned ?? false, draftText: message.teacherDraftText ?? '', draftSavedAt: message.teacherDraftSavedAt,
          appliedTemplate: isReplyTemplateDraft(message.teacherReplyTemplate) ? message.teacherReplyTemplate : undefined,
          officialTemplateApplied: isReplyTemplateDraft(message.teacherReplyTemplate),
          replies: conversation.map((entry) => ({
            id: entry.id, authorRole: entry.authorRole, authorName: entry.authorRole === 'teacher' ? message.teacherName : parentName,
            content: entry.body, deliveryStatus: entry.deliveryStatus, label: entry.authorRole === 'teacher' ? '선생님 답변' : '학부모 문의', time: formatReplyTime(entry.sentAt, message.sentAt), sentAt: entry.sentAt,
          })),
        });
      }
    } catch {
      // A damaged record belonging to another account must not prevent other threads from loading.
    }
  }
  return threads.sort((a, b) => b.latestAt.localeCompare(a.latestAt));
}

// Status fields are written only when this update changed them, so a stale tab cannot clear a newer follow-up's recheck flag.
export function persistTeacherParentThread(teacherUserId: number, thread: BoardThread, previous?: BoardThread) {
  if (thread.parentUserId === undefined) return;
  updateSentMessage(thread.parentUserId, thread.id, (message) => {
    if (!mockConnectedTeachers.some((teacher) => teacher.userId === teacherUserId && teacher.value === message.teacherId)) {
      throw new Error('담당 교사만 문의를 처리할 수 있습니다.');
    }
    const existing = getConversation(message);
    const addedReplies = thread.replies.filter((reply) => reply.authorRole === 'teacher' && !existing.some((entry) => entry.id === reply.id));
    return {
      ...message,
      consultationStatus: !previous || previous.status !== thread.status ? thread.status : message.consultationStatus,
      needsTeacherReview: !previous || previous.needsTeacherReview !== thread.needsTeacherReview
        ? thread.needsTeacherReview : message.needsTeacherReview,
      teacherDraftText: thread.draftText, teacherDraftSavedAt: thread.draftSavedAt, teacherPinned: thread.isPinned,
      teacherReplyTemplate: thread.appliedTemplate, activityLogs: thread.activityLogs ?? message.activityLogs,
      conversation: [...existing, ...addedReplies.map((reply) => ({
        id: reply.id, authorRole: 'teacher' as const, body: reply.content, deliveryStatus: reply.deliveryStatus, sentAt: reply.sentAt ?? thread.latestAt,
      }))],
      updatedAt: addedReplies.length > 0 ? thread.latestAt : message.updatedAt,
    };
  });
}
