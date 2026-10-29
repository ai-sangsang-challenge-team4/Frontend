import { RISK_EXPRESSION_KINDS, type MessageReview, type SentParentMessage } from './parentMessageTypes';

// Local composer step, not the server MessageStatus: PARENT_REVIEW means the parent is
// comparing the AI revision before sending.
export type MessageDraftStep = 'DRAFT' | 'PARENT_REVIEW';

// The server DRAFT behind a local draft (VITE_MESSAGE_API=http). Title, student, and teacher are fixed once
// it exists because PATCH /complaints/{id} only changes the content. Follow-ups keep their own serverMessageId
// and do not need a separate student selection.
export type ServerComplaintDraft = {
  complaintId: number;
  studentId?: number;
  teacherId: number;
  teacherName: string;
  title: string;
  // Masked content last stored on the server.
  content: string;
  analysisId: number | null;
  // Present only for additional inquiries; the initial inquiry is addressed by complaintId alone.
  serverMessageId?: number;
  contentVersion?: number;
};

export type MessageDraft = {
  messageId: string;
  teacherId: string;
  // The selected child and the selected teacher's name (http mode), kept for drafts saved before analysis,
  // which have no server draft to carry the name.
  studentId?: number;
  teacherName?: string;
  title: string;
  body: string;
  status: MessageDraftStep;
  review?: MessageReview;
  server?: ServerComplaintDraft;
  threadId?: string;
  savedAt?: string;
};

// Replace this fixture with the connected-teachers API when available.
export const mockConnectedTeachers = [
  { value: 'teacher-102', label: '김OO 선생님', userId: 201, className: '3학년 2반' },
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
    (analysis.analyzeOnSubmit === undefined || typeof analysis.analyzeOnSubmit === 'boolean') &&
    (analysis.revisionReason === undefined || analysis.revisionReason === null || typeof analysis.revisionReason === 'string') &&
    (analysis.maskedContent === undefined || typeof analysis.maskedContent === 'string') &&
    (analysis.riskSummary === undefined || (isRecord(analysis.riskSummary) &&
      typeof analysis.riskSummary.riskScore === 'number' && Number.isFinite(analysis.riskSummary.riskScore) &&
      ['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'].includes(String(analysis.riskSummary.riskLevel)))) &&
    Array.isArray(analysis.risks) && analysis.risks.every((risk: unknown) => (
      isRecord(risk) && typeof risk.id === 'string' &&
      (RISK_EXPRESSION_KINDS as readonly unknown[]).includes(risk.kind) &&
      typeof risk.title === 'string' && typeof risk.excerpt === 'string' &&
      typeof risk.explanation === 'string' &&
      (risk.suggestion === undefined || typeof risk.suggestion === 'string')
    )) && !(value.source === 'AI' && analysis.revisedText === null);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isServerDraft(value: unknown): value is ServerComplaintDraft {
  return isRecord(value) &&
    isPositiveInteger(value.complaintId) && (value.studentId === undefined || isPositiveInteger(value.studentId)) && isPositiveInteger(value.teacherId) &&
    (value.serverMessageId === undefined || isPositiveInteger(value.serverMessageId)) &&
    (value.contentVersion === undefined || (typeof value.contentVersion === 'number' && Number.isInteger(value.contentVersion) && value.contentVersion >= 0)) &&
    typeof value.teacherName === 'string' && typeof value.title === 'string' && typeof value.content === 'string' &&
    (value.analysisId === null || isPositiveInteger(value.analysisId));
}

function isSentMessage(value: unknown): value is SentParentMessage {
  return isRecord(value) && value.status === 'SENT' &&
    (value.serverComplaintId === undefined || isPositiveInteger(value.serverComplaintId)) &&
    (value.serverMessageId === undefined || isPositiveInteger(value.serverMessageId)) &&
    ['messageId', 'teacherId', 'teacherName', 'title', 'originalBody', 'finalBody', 'sentAt']
      .every((field) => typeof value[field] === 'string') &&
    (value.selectionType === 'AI' || value.selectionType === 'ORIGINAL' || value.selectionType === 'CUSTOM') &&
    (value.selectionSource === 'AI' || value.selectionSource === 'ORIGINAL') &&
    ['parentName', 'updatedAt', 'parentAcknowledgedAt', 'teacherDraftText', 'teacherDraftSavedAt']
      .every((field) => value[field] === undefined || typeof value[field] === 'string') &&
    ['isImportant', 'needsTeacherReview', 'teacherPinned']
      .every((field) => value[field] === undefined || typeof value[field] === 'boolean') &&
    (value.teacherReplyDraftTab === undefined || value.teacherReplyDraftTab === 'ai' || value.teacherReplyDraftTab === 'manual') &&
    (value.teacherReplyDrafts === undefined || (isRecord(value.teacherReplyDrafts) &&
      Object.entries(value.teacherReplyDrafts).every(([tab, draft]) => (
        (tab === 'ai' || tab === 'manual') && isRecord(draft) && typeof draft.draftText === 'string' &&
        (draft.draftSavedAt === undefined || typeof draft.draftSavedAt === 'string') &&
        ['aiDraftGenerated', 'officialTemplateApplied'].every((field) => draft[field] === undefined || typeof draft[field] === 'boolean')
      )))) &&
    (value.consultationStatus === undefined || ['before', 'inProgress', 'complete'].includes(String(value.consultationStatus))) &&
    (value.conversation === undefined || (Array.isArray(value.conversation) && value.conversation.every((entry: unknown) => (
      isRecord(entry) && typeof entry.id === 'string' && typeof entry.body === 'string' &&
      (entry.serverMessageId === undefined || isPositiveInteger(entry.serverMessageId)) &&
      typeof entry.sentAt === 'string' && (entry.authorRole === 'parent' || entry.authorRole === 'teacher') &&
      (entry.deliveryStatus === undefined || entry.deliveryStatus === 'SENT_TO_PARENT')
    )))) &&
    (value.activityLogs === undefined || (Array.isArray(value.activityLogs) && value.activityLogs.every((entry: unknown) => (
      isRecord(entry) && ['action', 'actor', 'detail', 'id', 'time'].every((field) => typeof entry[field] === 'string')
    )))) &&
    Array.isArray(value.auditLog) && value.auditLog.every((entry: unknown) => (
      isRecord(entry) && entry.action === 'SENT' && typeof entry.at === 'string' &&
      (entry.selectionType === 'AI' || entry.selectionType === 'ORIGINAL' || entry.selectionType === 'CUSTOM')
    ));
}

function parseDraft(draft: unknown): MessageDraft | null {
  if (!isRecord(draft)) return null;
  if (typeof draft.messageId !== 'string' || typeof draft.teacherId !== 'string' ||
    typeof draft.title !== 'string' || typeof draft.body !== 'string' ||
    (draft.status !== 'DRAFT' && draft.status !== 'PARENT_REVIEW') ||
    (draft.threadId !== undefined && typeof draft.threadId !== 'string') ||
    (draft.savedAt !== undefined && typeof draft.savedAt !== 'string') ||
    (draft.studentId !== undefined && !isPositiveInteger(draft.studentId)) ||
    (draft.teacherName !== undefined && typeof draft.teacherName !== 'string')) return null;
  let result = draft as MessageDraft;
  // An unreadable server state keeps the text; the next analysis starts a new server draft.
  if (result.server !== undefined && !isServerDraft(result.server)) result = { ...result, server: undefined, review: undefined, status: 'DRAFT' };
  return result.review !== undefined && !isMessageReview(result.review) ? { ...result, review: undefined } : result;
}

export function readMessageDraft(userId: number, messageId?: string): MessageDraft | null {
  if (messageId) return readMessageDrafts(userId).find((draft) => draft.messageId === messageId) ?? null;
  try {
    const stored = localStorage.getItem(draftKey(userId));
    return stored ? parseDraft(JSON.parse(stored)) : null;
  } catch {
    return null;
  }
  return null;
}

function draftsKey(userId: number) {
  return `${draftKey(userId)}.all`;
}

type DraftCollection = { entries: unknown[]; corrupted: string | null };

function readDraftCollection(userId: number): DraftCollection {
  const stored = localStorage.getItem(draftsKey(userId));
  if (!stored) return { entries: [], corrupted: null };
  try {
    const parsed: unknown = JSON.parse(stored);
    if (Array.isArray(parsed)) return { entries: parsed, corrupted: null };
  } catch {
    // Kept as a backup by writeDraftCollection below.
  }
  return { entries: [], corrupted: stored };
}

// Unreadable entries are written back unchanged, and a corrupted collection is backed up before it is replaced.
function writeDraftCollection(userId: number, collection: DraftCollection, entries: unknown[]) {
  if (collection.corrupted !== null) {
    localStorage.setItem(`${draftsKey(userId)}.corrupted.${Date.now()}`, collection.corrupted);
  }
  localStorage.setItem(draftsKey(userId), JSON.stringify(entries));
}

function isOtherDraft(messageId: string) {
  return (entry: unknown) => !isRecord(entry) || entry.messageId !== messageId;
}

// The legacy single-draft key may hold a draft that is not in the collection yet.
function readDraftEntries(userId: number, collection: DraftCollection) {
  const active = readMessageDraft(userId);
  return active ? [active, ...collection.entries.filter(isOtherDraft(active.messageId))] : collection.entries;
}

export function saveMessageDraft(userId: number, draft: MessageDraft) {
  const collection = readDraftCollection(userId);
  const entries = readDraftEntries(userId, collection);
  const saved = { ...draft, savedAt: new Date().toISOString() };
  localStorage.setItem(draftKey(userId), JSON.stringify(saved));
  writeDraftCollection(userId, collection, [saved, ...entries.filter(isOtherDraft(draft.messageId))]);
}

export function clearMessageDraft(userId: number, messageId: string) {
  const collection = readDraftCollection(userId);
  writeDraftCollection(userId, collection, readDraftEntries(userId, collection).filter(isOtherDraft(messageId)));
  if (readMessageDraft(userId)?.messageId === messageId) localStorage.removeItem(draftKey(userId));
}

export function readMessageDrafts(userId: number): MessageDraft[] {
  const active = readMessageDraft(userId);
  const drafts = readDraftCollection(userId).entries.map(parseDraft).filter((draft): draft is MessageDraft => draft !== null);
  return active ? [active, ...drafts.filter((draft) => draft.messageId !== active.messageId)] : drafts;
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
  window.dispatchEvent(new Event('parent-messages-changed'));
  return message;
}

export function updateSentMessage(userId: number, messageId: string, update: (message: SentParentMessage) => SentParentMessage) {
  const messages = readSentMessages(userId);
  const index = messages.findIndex((message) => message.messageId === messageId);
  if (index < 0) throw new Error('문의를 찾을 수 없습니다.');
  const message = update(messages[index]);
  messages[index] = message;
  localStorage.setItem(sentKey(userId), JSON.stringify(messages));
  window.dispatchEvent(new Event('parent-messages-changed'));
  return message;
}
