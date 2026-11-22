import type { BoardReply } from './types';
import { formatConversationDate } from './messageDates';

const MAX_GROUP_GAP_MS = 30 * 60 * 1000;

// The current conversation contract supplies role and name, but no sender ID.
// Missing or invalid timestamps start a new group; message order is never changed.
export function continuesReplyGroup(previous: BoardReply | undefined, current: BoardReply) {
  if (!previous || !previous.sentAt || !current.sentAt ||
      previous.authorRole !== current.authorRole || previous.authorName !== current.authorName ||
      !current.authorName.trim()) return false;
  const gap = Date.parse(current.sentAt) - Date.parse(previous.sentAt);
  return Number.isFinite(gap) && gap >= 0 && gap <= MAX_GROUP_GAP_MS &&
    formatConversationDate(previous.sentAt) === formatConversationDate(current.sentAt);
}
