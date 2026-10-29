import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { getApiErrorMessage, isApiError, REPLY_SEND_FAILED_MESSAGE } from '../../shared/api';
import { teacherInboxApi, type TeacherResponseDraftResponse } from './api/teacherInboxApi';
import { canGenerateReplyDraft, isReplyLocked } from './messageRules';
import { getReplyDraftTab, selectReplyDraft } from './replyDrafts';
import {
  applyServerSubmission,
  canRestoreServerDraft,
  getServerReplyBlockReason,
  markServerDraftSaved,
  restoreServerDraft,
  setReplyDraftTabState,
  shouldRestoreServerDraft,
} from './serverReplies';
import type { BoardThread } from './types';

export type ServerReplyAction = 'loadingDraft' | 'generatingAiDraft' | 'saving' | 'sending';
type ServerReplyPending = { threadId: string; action: ServerReplyAction } | null;

type UseServerReplyOptions = {
  setThreads: Dispatch<SetStateAction<BoardThread[]>>;
  // Reloads the thread's conversation, status, and history from the server.
  reloadDetail: (threadId: string) => Promise<void>;
  onMessage: (message: string) => void;
};

// An existing AI tab still counts after its contents have been cleared, so it is not refilled on entry.
function hasAiTab(thread: BoardThread) {
  return thread.replyDrafts?.ai !== undefined || (
    getReplyDraftTab(thread) === 'ai' && Boolean(thread.draftText || thread.appliedTemplate)
  );
}

function canReply(thread: BoardThread) {
  return thread.serverComplaintId !== undefined && !isReplyLocked(thread) && !getServerReplyBlockReason(thread);
}

// Teacher replies for server threads (VITE_MESSAGE_API=http): the AI draft, the single server draft,
// and sending. The safety lock and the emergency stage are checked here as well as on screen, because
// the server only checks that the complaint is waiting for the teacher.
export function useServerReply({ setThreads, reloadDetail, onMessage }: UseServerReplyOptions) {
  const [pending, setPendingState] = useState<ServerReplyPending>(null);
  // One request at a time; the ref answers before the state update renders.
  const pendingRef = useRef<ServerReplyPending>(null);
  const setPending = useCallback((value: ServerReplyPending) => {
    pendingRef.current = value;
    setPendingState(value);
  }, []);

  const updateThread = useCallback((threadId: string, updater: (thread: BoardThread) => BoardThread) => {
    setThreads((current) => current.map((thread) => thread.id === threadId ? updater(thread) : thread));
  }, [setThreads]);

  const refresh = useCallback((threadId: string) => {
    reloadDetail(threadId).catch(() => undefined);
  }, [reloadDetail]);

  // A 409 means the complaint moved on (answered elsewhere, closed); the reload shows its current state.
  const fail = useCallback((threadId: string, error: unknown, fallback: string) => {
    onMessage(getApiErrorMessage(error, fallback));
    if (isApiError(error) && error.code === 'RESPONSE_NOT_EDITABLE') refresh(threadId);
  }, [onMessage, refresh]);

  // Fills the AI tab with POST /response/ai-draft. The draft is not stored on the server until it is saved.
  const generateAiDraft = useCallback(async (thread: BoardThread) => {
    if (!canReply(thread) || !canGenerateReplyDraft(thread) || pendingRef.current) return;
    setPending({ threadId: thread.id, action: 'generatingAiDraft' });
    try {
      const response = await teacherInboxApi.generateAiDraft(thread.serverComplaintId!);
      updateThread(thread.id, (current) => {
        const aiDraft = getReplyDraftTab(current) === 'ai' ? current.draftText : current.replyDrafts?.ai?.draftText;
        // The lock may have been set meanwhile; a tab the teacher already wrote in is not replaced.
        if (isReplyLocked(current) || aiDraft?.trim()) return current;
        return setReplyDraftTabState(current, 'ai', { draftText: response.content, aiDraftGenerated: true });
      });
      // The server records AI_DRAFT_GENERATED in the history.
      refresh(thread.id);
    } catch (error) {
      fail(thread.id, error, 'AI 초안을 만들지 못했습니다. 직접 작성하거나 잠시 후 다시 시도해 주세요.');
    } finally {
      setPending(null);
    }
  }, [fail, refresh, setPending, updateThread]);

  // On entering the composer: restores the saved server draft once per session, then opens the AI tab
  // and generates its draft when the tab has never been filled.
  const initialize = useCallback(async (thread: BoardThread) => {
    if (!canReply(thread)) return;
    let next = thread;
    let restored = false;
    if (!thread.serverDraftChecked) {
      setPending({ threadId: thread.id, action: 'loadingDraft' });
      let draft: TeacherResponseDraftResponse | null | undefined;
      try {
        draft = await teacherInboxApi.getResponseDraft(thread.serverComplaintId!);
      } catch (error) {
        if (isApiError(error) && error.code === 'RESPONSE_DRAFT_NOT_FOUND') draft = null;
        else onMessage(getApiErrorMessage(error, '임시저장한 답변을 불러오지 못했습니다.'));
      } finally {
        setPending(null);
      }
      if (draft !== undefined) {
        restored = shouldRestoreServerDraft(thread, draft);
        next = restoreServerDraft(thread, draft);
        updateThread(thread.id, (current) => restoreServerDraft(current, draft));
        if (draft?.content.trim() && !canRestoreServerDraft(thread)) {
          onMessage('임시저장한 답변은 답장 예시 형식으로 되돌릴 수 없습니다. 예시를 다시 적용해 주세요.');
        }
      }
    }
    // A restored draft opens on the manual tab; the AI draft can still be made from the AI tab.
    if (restored) return;
    const hadAiTab = hasAiTab(next);
    updateThread(thread.id, (current) => selectReplyDraft(current, 'ai'));
    if (!hadAiTab && canGenerateReplyDraft(next)) await generateAiDraft(selectReplyDraft(next, 'ai'));
  }, [generateAiDraft, onMessage, setPending, updateThread]);

  // PUT /response-draft with the current tab only.
  const saveDraft = useCallback(async (thread: BoardThread) => {
    const content = thread.draftText.trim();
    if (!canReply(thread) || !content || pendingRef.current) return;
    setPending({ threadId: thread.id, action: 'saving' });
    try {
      const response = await teacherInboxApi.saveResponseDraft(thread.serverComplaintId!, { content });
      updateThread(thread.id, (current) => current.draftText.trim() === content
        ? markServerDraftSaved(current, response)
        : current);
    } catch (error) {
      fail(thread.id, error, '답변을 임시저장하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setPending(null);
    }
  }, [fail, setPending, updateThread]);

  // POST /responses. Resolves true once the server stored the reply and handed the turn to the parent.
  const submit = useCallback(async (thread: BoardThread, authorName: string) => {
    const content = thread.draftText.trim();
    if (!canReply(thread) || !content || pendingRef.current) return false;
    setPending({ threadId: thread.id, action: 'sending' });
    try {
      const response = await teacherInboxApi.submitResponse(thread.serverComplaintId!, { content });
      updateThread(thread.id, (current) => applyServerSubmission(current, response, authorName));
      refresh(thread.id);
      return true;
    } catch (error) {
      fail(thread.id, error, REPLY_SEND_FAILED_MESSAGE);
      return false;
    } finally {
      setPending(null);
    }
  }, [fail, refresh, setPending, updateThread]);

  return { generateAiDraft, initialize, pending, saveDraft, submit };
}
