import type { BoardThread, ReplyDraftState, ReplyDraftTab } from './types';
import { isReplyTemplateDraft } from './replyTemplates';

export function getReplyDraftTab(thread: BoardThread): ReplyDraftTab {
  return thread.replyDraftTab ?? (
    thread.aiDraftGenerated || thread.officialTemplateApplied || thread.appliedTemplate
      ? 'ai'
      : thread.draftText ? 'manual' : 'ai'
  );
}

export function getReplyDraftState(thread: BoardThread): ReplyDraftState {
  return {
    draftText: thread.draftText,
    draftSavedAt: thread.draftSavedAt,
    aiDraftGenerated: thread.aiDraftGenerated,
    officialTemplateApplied: thread.officialTemplateApplied,
    appliedTemplate: thread.appliedTemplate,
  };
}

// Keep draftText as the selected answer so saving, validation and sending share the same value.
export function selectReplyDraft(thread: BoardThread, tab: ReplyDraftTab): BoardThread {
  const replyDrafts = {
    ...thread.replyDrafts,
    [getReplyDraftTab(thread)]: getReplyDraftState(thread),
  };
  const selected = replyDrafts[tab] ?? { draftText: '' };
  replyDrafts[tab] = selected;

  return {
    ...thread,
    draftText: selected.draftText,
    draftSavedAt: selected.draftSavedAt,
    aiDraftGenerated: selected.aiDraftGenerated,
    officialTemplateApplied: selected.officialTemplateApplied,
    appliedTemplate: isReplyTemplateDraft(selected.appliedTemplate) ? selected.appliedTemplate : undefined,
    replyDraftTab: tab,
    replyDrafts,
  };
}

export function hasReplyDraft(thread: BoardThread) {
  return Boolean(thread.draftText.trim()) || Object.entries(thread.replyDrafts ?? {})
    .some(([tab, draft]) => tab !== getReplyDraftTab(thread) && Boolean(draft?.draftText.trim()));
}
