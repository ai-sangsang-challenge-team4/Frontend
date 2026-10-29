import { useEffect } from 'react';
import { useApiRequest } from '../../shared/api';
import { ESCALATIONS_CHANGED_EVENT } from './api';
import { MOCK_EMERGENCY_REVIEW_STORAGE_KEY, MOCK_ESCALATION_STORAGE_KEY } from './api/mockEscalationApi';

const MOCK_STORAGE_KEYS = [MOCK_ESCALATION_STORAGE_KEY, MOCK_EMERGENCY_REVIEW_STORAGE_KEY];

// useApiRequest that refetches when a share or admin action lands, in this tab or (mock) another.
// `request` must be memoized (useCallback).
export function useEscalationRequest<T>(request: (signal: AbortSignal) => Promise<T>) {
  const state = useApiRequest(request);
  const { retry } = state;

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === null || MOCK_STORAGE_KEYS.includes(event.key)) retry();
    };
    window.addEventListener(ESCALATIONS_CHANGED_EVENT, retry);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(ESCALATIONS_CHANGED_EVENT, retry);
      window.removeEventListener('storage', handleStorage);
    };
  }, [retry]);

  // Keep showing the last data during a background refetch instead of a spinner.
  return { ...state, isInitialLoading: state.isLoading && state.data === null };
}
