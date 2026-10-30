import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { getApiErrorMessage, isApiError, REPLY_SEND_FAILED_MESSAGE } from '../../shared/api';
import { teacherInboxApi, type TeacherResponseDraftResponse } from './api/teacherInboxApi';
import { canGenerateReplyDraft, canUseOfficialReplyTemplate, isReplyLocked } from './messageRules';
import { getReplyDraftTab, selectReplyDraft } from './replyDrafts';
import { getReplyTemplate } from './replyTemplates';
import {
  applyServerSubmission,
  canRestoreServerDraft,
  getServerReplyBlockReason,
  markServerDraftSaved,
  restoreServerDraft,
  setReplyDraftTabState,
  shouldRestoreServerDraft,
  toServerReplyTemplate,
  toTemplateAdoptionRequest,
} from './serverReplies';
import type { BoardThread } from './types';

export type ServerReplyAction = 'loadingTemplates' | 'loadingDraft' | 'generatingAiDraft' | 'saving' | 'sending';
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
  // Threads whose composer entry is still running, so reopening the composer does not repeat it.
  const initializingRef = useRef(new Set<string>());
  // The last adopted template reply per thread, so retrying a failed send does not record it twice.
  const adoptedRef = useRef(new Map<string, string>());
  const startPending = useCallback((threadId: string, action: ServerReplyAction) => {
    const value = { threadId, action };
    pendingRef.current = value;
    setPendingState(value);
    return value;
  }, []);
  // A finished request clears only its own pending state, never a newer request's.
  const endPending = useCallback((value: NonNullable<ServerReplyPending>) => {
    if (pendingRef.current !== value) return;
    pendingRef.current = null;
    setPendingState(null);
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
    const request = startPending(thread.id, 'generatingAiDraft');
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
      endPending(request);
    }
  }, [endPending, fail, refresh, startPending, updateThread]);

  // GET /response-templates for a High thread, once per session. The templates decide whether the manual
  // tab is open, so they load before the server draft is restored. A failure leaves no templates, and the
  // reply is written by hand.
  const loadTemplates = useCallback(async (thread: BoardThread) => {
    if (thread.serverTemplates !== undefined || !canUseOfficialReplyTemplate(thread)) return thread;
    const request = startPending(thread.id, 'loadingTemplates');
    let serverTemplates: BoardThread['serverTemplates'] = [];
    try {
      serverTemplates = (await teacherInboxApi.getResponseTemplates(thread.serverComplaintId!)).map(toServerReplyTemplate);
    } catch (error) {
      onMessage(getApiErrorMessage(error, '답장 예시를 불러오지 못했습니다. 직접 작성해 주세요.'));
    } finally {
      endPending(request);
    }
    updateThread(thread.id, (current) => ({ ...current, serverTemplates }));
    return { ...thread, serverTemplates };
  }, [endPending, onMessage, startPending, updateThread]);

  // On entering the composer: loads the High templates, restores the saved server draft once per session, then opens the AI tab
  // and generates its draft when the tab has never been filled. Reopening the composer while this runs
  // does nothing, so the draft is not loaded twice and the AI draft is not requested twice.
  const initialize = useCallback(async (thread: BoardThread) => {
    if (!canReply(thread) || initializingRef.current.has(thread.id)) return;
    initializingRef.current.add(thread.id);
    try {
      let next = await loadTemplates(thread);
      let restored = false;
      if (!next.serverDraftChecked) {
        const request = startPending(thread.id, 'loadingDraft');
        let draft: TeacherResponseDraftResponse | null | undefined;
        try {
          draft = await teacherInboxApi.getResponseDraft(next.serverComplaintId!);
        } catch (error) {
          if (isApiError(error) && error.code === 'RESPONSE_DRAFT_NOT_FOUND') draft = null;
          else onMessage(getApiErrorMessage(error, '임시저장한 답변을 불러오지 못했습니다.'));
        } finally {
          endPending(request);
        }
        if (draft !== undefined) {
          const checked = next;
          restored = shouldRestoreServerDraft(checked, draft);
          next = restoreServerDraft(checked, draft);
          updateThread(thread.id, (current) => restoreServerDraft(current, draft));
          if (draft?.content.trim() && !canRestoreServerDraft(checked)) {
            onMessage('임시저장한 답변은 답장 예시 형식으로 되돌릴 수 없습니다. 예시를 다시 적용해 주세요.');
          }
        }
      }
      // A restored draft opens on the manual tab; the AI draft can still be made from the AI tab.
      if (restored) return;
      const hadAiTab = hasAiTab(next);
      updateThread(thread.id, (current) => selectReplyDraft(current, 'ai'));
      if (!hadAiTab && canGenerateReplyDraft(next)) await generateAiDraft(selectReplyDraft(next, 'ai'));
    } finally {
      initializingRef.current.delete(thread.id);
    }
  }, [endPending, generateAiDraft, loadTemplates, onMessage, startPending, updateThread]);

  // PUT /response-draft with the current tab only. The tab is the one saved even if the teacher switches
  // tabs before the response, so the "saved" mark follows the server copy.
  const saveDraft = useCallback(async (thread: BoardThread) => {
    const content = thread.draftText.trim();
    if (!canReply(thread) || !content || pendingRef.current) return;
    const savedTab = getReplyDraftTab(thread);
    const request = startPending(thread.id, 'saving');
    try {
      const response = await teacherInboxApi.saveResponseDraft(thread.serverComplaintId!, { content });
      updateThread(thread.id, (current) => markServerDraftSaved(current, response, savedTab, content));
    } catch (error) {
      fail(thread.id, error, '답변을 임시저장하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      endPending(request);
    }
  }, [endPending, fail, startPending, updateThread]);

  // POST /responses. Resolves true once the server stored the reply and handed the turn to the parent.
  // A reply built from a server template is first recorded with POST /adoptions; if that fails nothing is sent.
  const submit = useCallback(async (thread: BoardThread, authorName: string) => {
    const content = thread.draftText.trim();
    if (!canReply(thread) || !content || pendingRef.current) return false;
    const request = startPending(thread.id, 'sending');
    try {
      const template = getReplyTemplate(thread.appliedTemplate?.templateId, thread);
      if (template?.serverVersionId !== undefined && thread.appliedTemplate) {
        const adoptionKey = `${template.serverVersionId}:${content}`;
        if (adoptedRef.current.get(thread.id) !== adoptionKey) {
          await teacherInboxApi.adoptResponseTemplate(
            thread.serverComplaintId!,
            template.serverVersionId,
            toTemplateAdoptionRequest(template, thread.appliedTemplate, content),
          );
          adoptedRef.current.set(thread.id, adoptionKey);
        }
      }
      const response = await teacherInboxApi.submitResponse(thread.serverComplaintId!, { content });
      updateThread(thread.id, (current) => applyServerSubmission(current, response, authorName));
      refresh(thread.id);
      return true;
    } catch (error) {
      fail(thread.id, error, REPLY_SEND_FAILED_MESSAGE);
      return false;
    } finally {
      endPending(request);
    }
  }, [endPending, fail, refresh, startPending, updateThread]);

  return { generateAiDraft, initialize, pending, saveDraft, submit };
}
