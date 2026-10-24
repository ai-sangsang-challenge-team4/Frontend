import type { MessageStatus } from '../../shared/types';
import type { MessageReview, SentParentMessage } from './parentMessageTypes';

export type MessageDraft = {
  messageId: string;
  teacherId: string;
  title: string;
  body: string;
  status: Extract<MessageStatus, 'DRAFT' | 'PARENT_REVIEW'>;
  review?: MessageReview;
};

// Replace this fixture with the connected-teachers API when available.
export const mockConnectedTeachers = [
  { value: 'teacher-102', label: '김OO 선생님' },
];

function draftKey(userId: number) {
  return `teacher-hub.parent-message-draft.${userId}`;
}

function sentKey(userId: number) {
  return `teacher-hub.parent-sent-messages.${userId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isMessageReview(value: unknown): value is MessageReview {
  if (!isRecord(value) || !isRecord(value.analysis)) return false;
  const analysis = value.analysis;
  return (value.source === 'AI' || value.source === 'ORIGINAL') &&
    typeof value.aiText === 'string' &&
    (value.originalEdit === null || typeof value.originalEdit === 'string') &&
    (analysis.status === 'ready' || analysis.status === 'failed') &&
    (analysis.revisedText === null || typeof analysis.revisedText === 'string') &&
    (analysis.meaningWarning === null || typeof analysis.meaningWarning === 'string') &&
    Array.isArray(analysis.risks) && analysis.risks.every((risk: unknown) => (
      isRecord(risk) && typeof risk.id === 'string' &&
      (risk.kind === 'repeat' || risk.kind === 'demand' || risk.kind === 'official') &&
      typeof risk.title === 'string' && typeof risk.excerpt === 'string' &&
      typeof risk.explanation === 'string'
    )) && !(value.source === 'AI' && analysis.revisedText === null);
}

function isSentMessage(value: unknown): value is SentParentMessage {
  return isRecord(value) && value.status === 'SENT' &&
    ['messageId', 'teacherId', 'teacherName', 'title', 'originalBody', 'finalBody', 'sentAt']
      .every((field) => typeof value[field] === 'string') &&
    (value.selectionType === 'AI' || value.selectionType === 'ORIGINAL' || value.selectionType === 'CUSTOM') &&
    (value.selectionSource === 'AI' || value.selectionSource === 'ORIGINAL') &&
    Array.isArray(value.auditLog) && value.auditLog.every((entry: unknown) => (
      isRecord(entry) && entry.action === 'SENT' && typeof entry.at === 'string' &&
      (entry.selectionType === 'AI' || entry.selectionType === 'ORIGINAL' || entry.selectionType === 'CUSTOM')
    ));
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
    ) {
      const result = draft as MessageDraft;
      if (result.review !== undefined && !isMessageReview(result.review)) {
        return { ...result, review: undefined };
      }
      return result;
    }
  } catch {
    return null;
  }
  return null;
}

export function saveMessageDraft(userId: number, draft: MessageDraft) {
  localStorage.setItem(draftKey(userId), JSON.stringify(draft));
}

export function clearMessageDraft(userId: number, messageId: string) {
  if (readMessageDraft(userId)?.messageId === messageId) localStorage.removeItem(draftKey(userId));
}

export function readSentMessages(userId: number): SentParentMessage[] {
  const stored = localStorage.getItem(sentKey(userId));
  if (!stored) return [];
  const messages: unknown = JSON.parse(stored);
  if (!Array.isArray(messages) || !messages.every(isSentMessage)) {
    throw new Error('저장된 문의 내역을 읽지 못했습니다.');
  }
  return messages;
}

export function findSentMessage(userId: number, messageId: string) {
  return readSentMessages(userId).find((message) => message.messageId === messageId) ?? null;
}

export function storeSentMessage(userId: number, message: SentParentMessage) {
  const messages = readSentMessages(userId);
  const existing = messages.find((item) => item.messageId === message.messageId);
  if (existing) return existing;
  localStorage.setItem(sentKey(userId), JSON.stringify([message, ...messages]));
  return message;
}
