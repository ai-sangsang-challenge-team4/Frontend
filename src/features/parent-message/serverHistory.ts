import { toServerInstant } from '../../shared/api';
import type { ComplaintStatus, WaitingFor } from '../../shared/types';
import {
  parentComplaintApi,
  type ParentComplaintDetailResponse,
  type ParentComplaintPageResponse,
  type ParentConversationResponse,
} from './api/parentComplaintApi';
import { getConversation } from './conversation';
import { readSentMessages, updateSentMessages } from './messageDraft';
import type { ConsultationStatus, ConversationMessage, SentParentMessage } from './parentMessageTypes';

// Parent inquiry history from the backend (VITE_MESSAGE_API=http). The server is the source of truth for the
// inquiries, their status, and the conversation; the browser copy keeps what the server has no API for
// (stars, the parent's "확인했어요", unsent drafts) and lets the composer continue a follow-up.
//
// GET /complaints and GET /complaints/{id} have no side effects. GET /complaints/{id}/messages marks the
// latest teacher reply as read, so only the detail screen loads it.

type ListItem = ParentComplaintPageResponse['content'][number];

// GET /complaints pages by 10; this caps one sync at 200 inquiries.
const MAX_LIST_PAGES = 20;

const SERVER_THREAD_PREFIX = 'server-';

// Local ID for an inquiry first seen on the server, e.g. one sent from another device.
export function serverThreadId(complaintId: number) {
  return `${SERVER_THREAD_PREFIX}${complaintId}`;
}

export function complaintIdFromThreadId(threadId: string) {
  const match = new RegExp(`^${SERVER_THREAD_PREFIX}(\\d+)$`).exec(threadId);
  const complaintId = match ? Number(match[1]) : NaN;
  return Number.isSafeInteger(complaintId) && complaintId > 0 ? complaintId : undefined;
}

// Server LocalDateTime (KST, no zone) to an ISO instant, so local and server times sort together.
function toInstant(value: string | null | undefined) {
  const instant = toServerInstant(value);
  return instant ? new Date(instant).toISOString() : undefined;
}

function latest(...values: (string | undefined)[]) {
  return values.filter((value): value is string => Boolean(value))
    .reduce<string | undefined>((max, value) => (!max || Date.parse(value) > Date.parse(max) ? value : max), undefined);
}

// CLOSED is a completed consultation. Otherwise a teacher reply (or the server waiting on the parent, which
// follows one) means it is in progress; a follow-up after a reply keeps it in progress.
function toConsultationStatus(status: ComplaintStatus, waitingFor: WaitingFor, hasTeacherReply: boolean, current?: ConsultationStatus): ConsultationStatus {
  if (status === 'CLOSED') return 'complete';
  if (waitingFor === 'PARENT' || hasTeacherReply) return 'inProgress';
  return current && current !== 'before' ? 'inProgress' : 'before';
}

function createServerThread(detail: ParentComplaintDetailResponse): SentParentMessage {
  const sentAt = toInstant(detail.createdAt) ?? new Date().toISOString();
  return {
    messageId: serverThreadId(detail.complaintId),
    serverComplaintId: detail.complaintId,
    teacherId: '',
    teacherName: detail.teacherName,
    title: detail.title,
    originalBody: detail.content,
    finalBody: detail.content,
    selectionType: 'ORIGINAL',
    selectionSource: 'ORIGINAL',
    status: 'SENT',
    sentAt,
    auditLog: [{ action: 'SENT', at: sentAt, selectionType: 'ORIGINAL' }],
    consultationStatus: toConsultationStatus(detail.status, detail.waitingFor, false),
    serverWaitingFor: detail.waitingFor,
    updatedAt: sentAt,
  };
}

function applyListItem(thread: SentParentMessage, item: ListItem): SentParentMessage {
  const hasTeacherReply = getConversation(thread).some((entry) => entry.authorRole === 'teacher');
  return {
    ...thread,
    title: item.title,
    teacherName: item.counterpartName ?? thread.teacherName,
    consultationStatus: toConsultationStatus(item.status, item.waitingFor, hasTeacherReply, thread.consultationStatus),
    serverWaitingFor: item.waitingFor,
    updatedAt: latest(thread.updatedAt, thread.sentAt, toInstant(item.latestReceivedAt)),
  };
}

// Server messages replace the local conversation. The first parent message keeps the thread's ID, as
// getConversation gives it, and later parent messages keep their local IDs, which drafts and retries match on.
function applyConversation(thread: SentParentMessage, response: ParentConversationResponse): SentParentMessage {
  const local = getConversation(thread);
  const sent = response.messages.filter((message) => message.status !== 'DRAFT' && message.sentAt);
  let firstParent = true;
  const conversation = sent.map((message): ConversationMessage => {
    const sentAt = toInstant(message.sentAt)!;
    const isParent = message.senderRole === 'PARENT';
    const localId = isParent && firstParent ? thread.messageId
      : local.find((entry) => entry.serverMessageId === message.messageId)?.id;
    if (isParent) firstParent = false;
    return {
      id: localId ?? `${SERVER_THREAD_PREFIX}message-${message.messageId}`,
      serverMessageId: message.messageId,
      authorRole: isParent ? 'parent' : 'teacher',
      body: message.content,
      sentAt,
    };
  });
  if (conversation.length === 0) return thread;
  return {
    ...thread,
    conversation,
    consultationStatus: toConsultationStatus(response.status, response.waitingFor,
      conversation.some((entry) => entry.authorRole === 'teacher'), thread.consultationStatus),
    serverWaitingFor: response.waitingFor,
    updatedAt: latest(thread.updatedAt, conversation.at(-1)!.sentAt),
  };
}

function findServerThread(messages: SentParentMessage[], complaintId: number) {
  return messages.find((message) => message.serverComplaintId === complaintId);
}

function upsert(messages: SentParentMessage[], thread: SentParentMessage) {
  const index = messages.findIndex((message) => message.messageId === thread.messageId);
  return index < 0 ? [thread, ...messages] : messages.map((message, i) => (i === index ? thread : message));
}

// Brings every submitted inquiry into the browser copy. Inquiries not stored yet are read once with
// GET /complaints/{id} for their content. Server DRAFTs are the composer's, not history entries.
export async function syncServerComplaints(userId: number, signal?: AbortSignal) {
  const items: ListItem[] = [];
  for (let page = 0; page < MAX_LIST_PAGES; page += 1) {
    const response = await parentComplaintApi.listComplaints({ page }, signal);
    items.push(...response.content.filter((item) => item.status !== 'DRAFT'));
    if (!response.hasNext) break;
  }
  const stored = readSentMessages(userId);
  const details = new Map<number, ParentComplaintDetailResponse>();
  for (const item of items) {
    if (findServerThread(stored, item.complaintId)) continue;
    details.set(item.complaintId, await parentComplaintApi.getComplaint(item.complaintId, signal));
  }
  signal?.throwIfAborted();
  updateSentMessages(userId, (messages) => items.reduce((next, item) => {
    const thread = findServerThread(next, item.complaintId);
    const detail = details.get(item.complaintId);
    if (thread) return upsert(next, applyListItem(thread, item));
    return detail ? upsert(next, applyListItem(createServerThread(detail), item)) : next;
  }, messages));
}

// Loads one inquiry's conversation, including the teacher's replies, into the browser copy. This marks the
// latest teacher reply as read on the server.
export async function syncServerConversation(userId: number, complaintId: number, signal?: AbortSignal) {
  const response = await parentComplaintApi.getConversation(complaintId, signal);
  const detail = findServerThread(readSentMessages(userId), complaintId)
    ? null : await parentComplaintApi.getComplaint(complaintId, signal);
  signal?.throwIfAborted();
  updateSentMessages(userId, (messages) => {
    const thread = findServerThread(messages, complaintId) ?? (detail ? createServerThread(detail) : null);
    return thread ? upsert(messages, applyConversation(thread, response)) : messages;
  });
}
