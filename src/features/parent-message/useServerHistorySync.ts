import { useCallback, useEffect } from 'react';
import { useApiRequest } from '../../shared/api';
import { parentMessageApiMode } from './api/parentComplaintApi';
import { syncServerComplaints, syncServerConversation } from './serverHistory';

const idle = () => Promise.resolve(null);

// Syncs the browser copy from the server in http mode, again when the window regains focus so new teacher
// replies appear. The screens keep reading useParentMessages, which refreshes on each write.
// `complaintId` syncs that inquiry's conversation; null syncs the list; undefined (a local-only inquiry or
// mock mode) does nothing.
export function useServerHistorySync(userId: number, complaintId: number | null | undefined) {
  const enabled = parentMessageApiMode === 'http' && complaintId !== undefined;
  const request = useApiRequest(useCallback((signal: AbortSignal) => {
    if (!enabled) return idle();
    return (complaintId === null ? syncServerComplaints(userId, signal) : syncServerConversation(userId, complaintId!, signal))
      .then(() => null);
  }, [enabled, userId, complaintId]));
  const { retry } = request;
  useEffect(() => {
    if (!enabled) return;
    window.addEventListener('focus', retry);
    return () => window.removeEventListener('focus', retry);
  }, [enabled, retry]);
  return { enabled, isLoading: enabled && request.isLoading, error: enabled ? request.error : null, retry };
}
