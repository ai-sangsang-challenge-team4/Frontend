import type { MessageStatus } from '../../shared/types';

export type MessageDraft = {
  messageId: string;
  teacherId: string;
  title: string;
  body: string;
  status: Extract<MessageStatus, 'DRAFT' | 'PARENT_REVIEW'>;
};

// Replace this fixture with the connected-teachers API when available.
export const mockConnectedTeachers = [
  { value: 'teacher-102', label: '김OO 선생님' },
];

function draftKey(userId: number) {
  return `teacher-hub.parent-message-draft.${userId}`;
}

export function readMessageDraft(userId: number): MessageDraft | null {
  try {
    const stored = localStorage.getItem(draftKey(userId));
    if (!stored) return null;
    const draft: unknown = JSON.parse(stored);
    if (typeof draft !== 'object' || draft === null) return null;
    if (
      'messageId' in draft && typeof draft.messageId === 'string' &&
      'teacherId' in draft && typeof draft.teacherId === 'string' &&
      'title' in draft && typeof draft.title === 'string' &&
      'body' in draft && typeof draft.body === 'string' &&
      'status' in draft && (draft.status === 'DRAFT' || draft.status === 'PARENT_REVIEW')
    ) return draft as MessageDraft;
  } catch {
    return null;
  }
  return null;
}

export function saveMessageDraft(userId: number, draft: MessageDraft) {
  localStorage.setItem(draftKey(userId), JSON.stringify(draft));
}
