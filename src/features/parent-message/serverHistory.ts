import { toServerInstant } from '../../shared/api';
import {
  parentComplaintApi,
  type ParentComplaintDetailResponse,
  type ParentComplaintPageResponse,
  type ParentConversationResponse,
  type ParentComplaintListQuery,
} from './api/parentComplaintApi';
import { applyServerComplaintState, canWriteAdditionalInquiry, getConversation } from './conversation';
import { readSentMessages, updateSentMessages } from './messageDraft';
import type { ConversationMessage, SentParentMessage } from './parentMessageTypes';

// Parent inquiry history from the backend (VITE_MESSAGE_API=http). The server is the source of truth for the
// inquiries, their status, and the conversation; the browser copy keeps what the server has no API for
// (stars and unsent drafts) and lets the composer continue a follow-up.
//
// GET /complaints and GET /complaints/{id} have no side effects. GET /complaints/{id}/messages marks the
// latest teacher reply as read, so only the detail screen loads it.

type ListItem = ParentComplaintPageResponse['content'][number];

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

// A response already in flight must not undo a close or reopen recorded while it was loading.
function hasSameServerState(current: SentParentMessage, previous: SentParentMessage | undefined) {
  return current.serverComplaintStatus === previous?.serverComplaintStatus && current.serverWaitingFor === previous?.serverWaitingFor;
}

function createServerThread(detail: ParentComplaintDetailResponse): SentParentMessage {
  const sentAt = toInstant(detail.createdAt) ?? new Date().toISOString();
  return applyServerComplaintState({
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
    updatedAt: sentAt,
  }, detail);
}

function applyListItem(thread: SentParentMessage, item: ListItem, useResponseState: boolean): SentParentMessage {
  const updated = {
    ...thread,
    title: item.title,
    teacherName: item.counterpartName ?? thread.teacherName,
    updatedAt: latest(thread.updatedAt, thread.sentAt, toInstant(item.latestReceivedAt)),
  };
  return useResponseState ? applyServerComplaintState(updated, item) : updated;
}

// Server messages replace the local conversation. The first parent message keeps the thread's ID, as
// getConversation gives it, and later parent messages keep their local IDs, which drafts and retries match on.
function applyConversation(thread: SentParentMessage, response: ParentConversationResponse, useResponseState: boolean): SentParentMessage {
  const local = getConversation(thread);
  const sent = response.messages.filter((message) => message.status !== 'DRAFT' && message.sentAt);
  // Sent messages are immutable and /messages returns the whole conversation. A
  // response missing a message already confirmed by the server is an older snapshot.
  const serverMessageIds = new Set(sent.map((message) => message.messageId));
  if (local.some((entry) => entry.serverMessageId !== undefined && !serverMessageIds.has(entry.serverMessageId))) return thread;
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
  if (conversation.length === 0) return useResponseState ? applyServerComplaintState(thread, response) : thread;
  const previousParent = local.filter((entry) => entry.authorRole === 'parent').at(-1);
  const latestParent = conversation.filter((entry) => entry.authorRole === 'parent').at(-1);
  const latestTeacher = sent.filter((message) => message.senderRole === 'TEACHER').at(-1);
  const sameSubmission = latestParent && previousParent &&
    latestParent.id === previousParent.id && latestParent.body === previousParent.body;
  const updated = {
    ...thread,
    // Send metadata belongs to one parent message. A newer inquiry from another
    // device has no local analysis result; a teacher reply alone does not invalidate it.
    submissionAnalysis: sameSubmission ? thread.submissionAnalysis : undefined,
    conversation,
    parentAcknowledgedAt: latest(thread.parentAcknowledgedAt, toInstant(latestTeacher?.readAt)),
    updatedAt: latest(thread.updatedAt, conversation.at(-1)!.sentAt),
  };
  return useResponseState ? applyServerComplaintState(updated, response) : updated;
}

function findServerThread(messages: SentParentMessage[], complaintId: number) {
  return messages.find((message) => message.serverComplaintId === complaintId);
}

function upsert(messages: SentParentMessage[], thread: SentParentMessage) {
  const index = messages.findIndex((message) => message.messageId === thread.messageId);
  return index < 0 ? [thread, ...messages] : messages.map((message, i) => (i === index ? thread : message));
}

export async function prepareServerFollowUp(userId: number, threadId: string, signal: AbortSignal) {
  const localThread = readSentMessages(userId).find((message) => message.messageId === threadId);
  const complaintId = localThread ? localThread.serverComplaintId : complaintIdFromThreadId(threadId);
  if (complaintId === undefined) return null;

  // Check the turn without marking teacher replies as read.
  const detail = await parentComplaintApi.getComplaint(complaintId, signal);
  signal.throwIfAborted();
  const canWrite = canWriteAdditionalInquiry(detail.status, detail.waitingFor);
  const existing = findServerThread(readSentMessages(userId), complaintId);
  if (existing || !canWrite) return { canWrite, threadId: existing?.messageId ?? threadId };

  const thread = createServerThread(detail);
  updateSentMessages(userId, (messages) => upsert(messages, thread));
  return { canWrite, threadId: thread.messageId };
}

// Loads one server page into the local copy, without marking replies as read. The caller owns
// pagination and search; locally cached inquiries are never mistaken for the server's search results.
export async function syncServerComplaints(userId: number, signal?: AbortSignal, query: ParentComplaintListQuery = {}) {
  const previous = new Map(readSentMessages(userId).map((thread) => [thread.serverComplaintId, thread]));
  const items: ListItem[] = [];
  let page = query.page ?? 0;
  let hasNext = false;
  while (true) {
    signal?.throwIfAborted();
    const response = await parentComplaintApi.listComplaints({ ...query, page }, signal);
    items.push(...response.content.filter((item) => item.status !== 'DRAFT'));
    hasNext = response.hasNext;
    if (items.length > 0 || !hasNext) break;
    // Draft-only pages must not strand submitted inquiries on a later page.
    page += 1;
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
    if (thread) return upsert(next, applyListItem(thread, item, hasSameServerState(thread, previous.get(item.complaintId))));
    return detail ? upsert(next, applyListItem(createServerThread(detail), item, true)) : next;
  }, messages));
  return { complaintIds: items.map((item) => item.complaintId), page, hasNext };
}

// Loads one inquiry's conversation, including the teacher's replies, into the browser copy. This marks the
// latest teacher reply as read on the server.
export async function syncServerConversation(userId: number, complaintId: number, signal?: AbortSignal) {
  const previous = findServerThread(readSentMessages(userId), complaintId);
  const response = await parentComplaintApi.getConversation(complaintId, signal);
  const detail = findServerThread(readSentMessages(userId), complaintId)
    ? null : await parentComplaintApi.getComplaint(complaintId, signal);
  signal?.throwIfAborted();
  updateSentMessages(userId, (messages) => {
    const existing = findServerThread(messages, complaintId);
    const thread = existing ?? (detail ? createServerThread(detail) : null);
    return thread ? upsert(messages, applyConversation(thread, response, !existing || hasSameServerState(existing, previous))) : messages;
  });
}
