import { useEffect, useState } from 'react';
import { isAbortError } from '../../shared/api';
import { loadServerRevision } from './serverComplaint';
import type { ParentMessageAnalysis } from './parentMessageTypes';

// Findings are generated asynchronously after risk analysis. Bound automatic polling; a retry reads
// the same analysis and never spends another analysis attempt or blocks the parent's original text.
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 15;

export function useServerRevision(analysisId: number | undefined, maskedContent: string, enabled: boolean) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    analysisId?: number;
    analysis: ParentMessageAnalysis | null;
    needsRetry: boolean;
  }>({ analysis: null, needsRetry: false });

  useEffect(() => {
    if (!enabled || analysisId === undefined) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let polls = 0;
    setState({ analysisId, analysis: null, needsRetry: false });
    const poll = async () => {
      try {
        const analysis = await loadServerRevision(analysisId, maskedContent, controller.signal);
        if (controller.signal.aborted) return;
        if (analysis.revisionStatus !== 'PENDING') {
          setState({ analysisId, analysis, needsRetry: false });
        } else if (++polls < MAX_POLL_ATTEMPTS) {
          timer = setTimeout(() => { void poll(); }, POLL_INTERVAL_MS);
        } else {
          setState({ analysisId, analysis: null, needsRetry: true });
        }
      } catch (error) {
        if (!controller.signal.aborted && !isAbortError(error)) {
          setState({ analysisId, analysis: null, needsRetry: true });
        }
      }
    };
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [analysisId, attempt, enabled, maskedContent]);

  return {
    analysis: state.analysisId === analysisId ? state.analysis : null,
    needsRetry: state.analysisId === analysisId && state.needsRetry,
    retry: () => setAttempt((value) => value + 1),
  };
}
