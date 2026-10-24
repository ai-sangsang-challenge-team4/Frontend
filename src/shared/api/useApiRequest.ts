import { useCallback, useEffect, useState } from 'react';
import { isAbortError, toApiError, type ApiError } from './apiError';

type ApiRequestState<T> = {
  data: T | null;
  error: ApiError | null;
  isLoading: boolean;
};

// `request` must be memoized (useCallback); a new reference triggers a new request.
export function useApiRequest<T>(request: (signal: AbortSignal) => Promise<T>) {
  const [state, setState] = useState<ApiRequestState<T>>({ data: null, error: null, isLoading: true });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState((current) => ({ ...current, error: null, isLoading: true }));
    request(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ data, error: null, isLoading: false });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isAbortError(error)) return;
        setState((current) => ({ ...current, error: toApiError(error), isLoading: false }));
      });
    return () => controller.abort();
  }, [request, attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  return { ...state, retry };
}
