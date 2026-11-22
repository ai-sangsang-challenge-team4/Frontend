import { useEffect, useState } from 'react';
import { isAbortError } from '../../shared/api';
import { loadServerRevision } from './serverComplaint';
import type { ParentMessageAnalysis } from './parentMessageTypes';

// Findings are generated asynchronously after risk analysis. Bound automatic polling; a retry reads
// the same analysis and never spends another analysis attempt or blocks the parent's original text.
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 15;

type RevisionLookupStatus = 'idle' | 'loading' | 'polling' | 'complete' | 'exhausted' | 'error';

export function useServerRevision(analysisId: number | undefined, maskedContent: string, enabled: boolean) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    analysisId?: number;
    maskedContent?: string;
    analysis: ParentMessageAnalysis | null;
    lookupStatus: RevisionLookupStatus;
  }>({ analysis: null, lookupStatus: 'idle' });

  useEffect(() => {
    if (!enabled || analysisId === undefined || !Number.isInteger(analysisId) || analysisId <= 0) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let polls = 0;
    // Revalidate on entry regardless of the saved server status. Retain the last successful
    // response across retries, but never share it with a different analysis or text version.
    setState((previous) => ({
      analysisId, maskedContent,
      analysis: previous.analysisId === analysisId && previous.maskedContent === maskedContent ? previous.analysis : null,
      lookupStatus: 'loading',
    }));
    const poll = async () => {
      try {
        const analysis = await loadServerRevision(analysisId, maskedContent, controller.signal);
        if (controller.signal.aborted) return;
        if (analysis.revisionStatus !== 'PENDING') {
          setState({ analysisId, maskedContent, analysis, lookupStatus: 'complete' });
          return;
        }
        const exhausted = ++polls >= MAX_POLL_ATTEMPTS;
        setState({ analysisId, maskedContent, analysis, lookupStatus: exhausted ? 'exhausted' : 'polling' });
        if (!exhausted) timer = setTimeout(() => { void poll(); }, POLL_INTERVAL_MS);
      } catch (error) {
        if (!controller.signal.aborted && !isAbortError(error)) {
          setState((previous) => ({ ...previous, lookupStatus: 'error' }));
        }
      }
    };
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [analysisId, attempt, enabled, maskedContent]);

  return {
    analysis: state.analysisId === analysisId && state.maskedContent === maskedContent ? state.analysis : null,
    lookupStatus: state.analysisId === analysisId && state.maskedContent === maskedContent ? state.lookupStatus : 'idle',
    retry: () => setAttempt((value) => value + 1),
  };
}
