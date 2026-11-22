import { useCallback, useEffect, useRef, useState } from 'react';
import { isAbortError, toApiError, type ApiError } from '../../shared/api';
import { parentMessageApiMode } from './api/parentComplaintApi';
import { syncServerComplaints } from './serverHistory';

type ListState = {
  keyword: string;
  complaintIds: number[];
  page: number;
  hasNext: boolean;
  isLoading: boolean;
  error: ApiError | null;
};

export function useServerParentList(userId: number, query: string) {
  const enabled = parentMessageApiMode === 'http';
  const keyword = query.trim();
  const [search, setSearch] = useState({ keyword });
  const debouncedKeyword = search.keyword;
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<ListState>({
    keyword, complaintIds: [], page: -1, hasNext: false, isLoading: enabled, error: null,
  });
  const controllerRef = useRef<AbortController | null>(null);
  const lastKeyword = useRef(keyword);
  const failedPage = useRef(0);
  const pending = useRef(false);

  useEffect(() => {
    if (!enabled || lastKeyword.current === keyword) return;
    lastKeyword.current = keyword;
    // Cancel immediately on edits; do not let an old keyword response become the new result.
    controllerRef.current?.abort();
    const timer = window.setTimeout(() => setSearch({ keyword }), 300);
    return () => window.clearTimeout(timer);
  }, [enabled, keyword]);

  const load = useCallback(async (page: number) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    pending.current = true;
    setState((current) => ({
      ...current, keyword: debouncedKeyword, isLoading: true, error: null,
      ...(page === 0 ? { complaintIds: [], page: -1, hasNext: false } : {}),
    }));
    try {
      const result = await syncServerComplaints(userId, controller.signal, { page, keyword: debouncedKeyword });
      if (controller.signal.aborted) return;
      failedPage.current = 0;
      setState((current) => ({
        keyword: debouncedKeyword,
        complaintIds: page === 0 ? result.complaintIds : [...new Set([...current.complaintIds, ...result.complaintIds])],
        page: result.page, hasNext: result.hasNext, isLoading: false, error: null,
      }));
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) return;
      failedPage.current = page;
      setState((current) => ({ ...current, isLoading: false, error: toApiError(error) }));
    } finally {
      if (controllerRef.current === controller) pending.current = false;
    }
  }, [debouncedKeyword, userId]);

  useEffect(() => {
    if (!enabled) return;
    void load(0);
    return () => controllerRef.current?.abort();
  }, [enabled, load, revision, search]);

  useEffect(() => {
    if (!enabled) return;
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [enabled]);

  const matchesQuery = keyword === debouncedKeyword && state.keyword === keyword;
  return {
    enabled,
    complaintIds: matchesQuery ? state.complaintIds : [],
    hasNext: matchesQuery && state.hasNext,
    isLoading: enabled && (!matchesQuery || state.isLoading),
    error: matchesQuery ? state.error : null,
    retry: () => { if (!pending.current && matchesQuery) void load(failedPage.current); },
    loadMore: () => { if (!pending.current && matchesQuery && state.hasNext) void load(state.page + 1); },
  };
}
