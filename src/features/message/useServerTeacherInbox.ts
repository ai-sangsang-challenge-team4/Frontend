import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { isAbortError, isApiError, toApiError, type ApiError } from '../../shared/api';
import type { HistoryEvent, TeacherRiskResponse } from '../escalation/escalationTypes';
import { teacherInboxApi, type TeacherComplaintDetailResponse } from './api/teacherInboxApi';
import {
  markServerDetailLoading,
  mergeServerDetail,
  toComplaintListQuery,
  toListThread,
  toServerComplaintNumber,
  type ServerInboxFilters,
} from './serverThreads';
import type { BoardThread } from './types';

const SEARCH_DEBOUNCE_MS = 300;

type ListState = {
  error: ApiError | null;
  hasNext: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  page: number;
  totalElements: number;
};

const initialListState: ListState = {
  error: null, hasNext: false, isLoading: true, isLoadingMore: false, page: 0, totalElements: 0,
};

type UseServerTeacherInboxOptions = {
  enabled: boolean;
  filters: ServerInboxFilters;
  setThreads: Dispatch<SetStateAction<BoardThread[]>>;
};

// Inserts or replaces threads by id. A thread whose detail is already loaded keeps it.
function upsertListThreads(current: BoardThread[], incoming: BoardThread[]) {
  const byId = new Map(current.map((thread) => [thread.id, thread]));
  for (const thread of incoming) {
    const existing = byId.get(thread.id);
    byId.set(thread.id, existing?.analysis ? existing : thread);
  }
  return [...byId.values()];
}

function detailToListThread(detail: TeacherComplaintDetailResponse) {
  return toListThread({
    complaintId: detail.complaintId,
    title: detail.title,
    studentId: 0,
    studentName: detail.studentName,
    counterpartName: detail.parentName,
    counterpartRole: 'PARENT',
    academicYear: detail.academicYear,
    grade: detail.grade,
    classNo: detail.classNo,
    status: detail.status,
    waitingFor: detail.waitingFor,
    riskAnalysisId: null,
    riskLevel: detail.riskLevel,
    aiSummary: null,
    latestReceivedAt: detail.submittedAt,
  });
}

// Server-backed inbox for VITE_MESSAGE_API=http. The list order comes from the server page by page
// (filters, keyword, and sort are applied there); threads live in the caller's state so that local
// edits and opened details survive a filter change.
export function useServerTeacherInbox({ enabled, filters, setThreads }: UseServerTeacherInboxOptions) {
  const [listIds, setListIds] = useState<string[]>([]);
  const [listState, setListState] = useState<ListState>(initialListState);
  const [attempt, setAttempt] = useState(0);
  const [debouncedQuery, setDebouncedQuery] = useState(filters.query);
  const listController = useRef<AbortController | null>(null);
  const { risk, sort, status } = filters;

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setTimeout(() => setDebouncedQuery(filters.query), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [enabled, filters.query]);

  const loadPage = useCallback(async (page: number) => {
    listController.current?.abort();
    const controller = new AbortController();
    listController.current = controller;
    setListState((current) => ({ ...current, error: null, isLoading: page === 0, isLoadingMore: page > 0 }));
    try {
      const response = await teacherInboxApi.listComplaints(
        toComplaintListQuery({ query: debouncedQuery, risk, sort, status }, page),
        controller.signal,
      );
      if (controller.signal.aborted) return;
      const threads = response.content.map(toListThread);
      setThreads((current) => upsertListThreads(current, threads));
      setListIds((current) => {
        const ids = threads.map((thread) => thread.id);
        return page === 0 ? ids : [...current, ...ids.filter((id) => !current.includes(id))];
      });
      setListState({
        error: null,
        hasNext: response.hasNext,
        isLoading: false,
        isLoadingMore: false,
        page: response.page,
        totalElements: response.totalElements,
      });
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) return;
      setListState((current) => ({ ...current, error: toApiError(error), isLoading: false, isLoadingMore: false }));
    }
  }, [debouncedQuery, risk, setThreads, sort, status]);

  useEffect(() => {
    if (!enabled) return;
    void loadPage(0);
    return () => listController.current?.abort();
  }, [attempt, enabled, loadPage]);

  const loadMore = useCallback(() => {
    if (listState.hasNext && !listState.isLoadingMore) void loadPage(listState.page + 1);
  }, [listState.hasNext, listState.isLoadingMore, listState.page, loadPage]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  // Loads detail, conversation, risk, and history together. A missing analysis (404) shows as a failed
  // analysis instead of failing the whole thread; other errors reject so the caller can say so.
  const loadDetail = useCallback(async (threadId: string, signal?: AbortSignal) => {
    const complaintId = toServerComplaintNumber(threadId);
    if (complaintId === null) return;
    setThreads((current) => current.map((thread) => thread.id === threadId ? markServerDetailLoading(thread) : thread));
    const [detail, conversation, risk, history] = await Promise.all([
      teacherInboxApi.getComplaint(complaintId, signal),
      teacherInboxApi.getConversation(complaintId, signal),
      teacherInboxApi.getRisk(complaintId, signal).catch((error: unknown): TeacherRiskResponse | null => {
        if (isApiError(error) && error.status === 404) return null;
        throw error;
      }),
      teacherInboxApi.getHistory(complaintId, signal).then((response) => response.events, (): HistoryEvent[] => []),
    ]);
    if (signal?.aborted) return;
    setThreads((current) => {
      const existing = current.find((thread) => thread.id === threadId);
      const merged = mergeServerDetail(existing ?? detailToListThread(detail), { detail, conversation, risk, history });
      return existing ? current.map((thread) => thread.id === threadId ? merged : thread) : [...current, merged];
    });
  }, [setThreads]);

  // POST /original-views returns the original and records the view, so the history is reloaded after it.
  const viewOriginal = useCallback(async (threadId: string) => {
    const complaintId = toServerComplaintNumber(threadId);
    if (complaintId === null) return;
    const response = await teacherInboxApi.viewOriginal(complaintId);
    setThreads((current) => current.map((thread) => thread.id === threadId
      ? { ...thread, originalMessage: response.content }
      : thread));
    void loadDetail(threadId).catch(() => undefined);
  }, [loadDetail, setThreads]);

  return { listIds, listState, loadDetail, loadMore, retry, viewOriginal };
}
