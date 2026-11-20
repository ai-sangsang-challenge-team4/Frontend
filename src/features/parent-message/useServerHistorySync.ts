import { useCallback, useEffect } from 'react';
import { useApiRequest } from '../../shared/api';
import { parentMessageApiMode } from './api/parentComplaintApi';
import { syncServerComplaints, syncServerConversation } from './serverHistory';

// Syncs the browser copy from the server in http mode, again when the window regains focus so new teacher
// replies appear. The screens keep reading useParentMessages, which refreshes on each write.
// `complaintId` syncs that inquiry's conversation; null syncs the list; undefined (a local-only inquiry or
// mock mode) does nothing.
export function useServerHistorySync(userId: number, complaintId: number | null | undefined) {
  const enabled = parentMessageApiMode === 'http' && complaintId !== undefined;
  const request = useApiRequest(useCallback(async (signal: AbortSignal) => {
    if (!enabled) return null;
    await (complaintId === null ? syncServerComplaints(userId, signal) : syncServerConversation(userId, complaintId, signal));
    return { userId, complaintId };
  }, [enabled, userId, complaintId]));
  const { retry } = request;
  useEffect(() => {
    if (!enabled) return;
    window.addEventListener('focus', retry);
    return () => window.removeEventListener('focus', retry);
  }, [enabled, retry]);
  // A background refresh keeps the last successful result for the same inquiry and account.
  const hasSynced = enabled && request.data?.userId === userId && request.data.complaintId === complaintId;
  return { enabled, hasSynced, isLoading: enabled && request.isLoading, error: enabled ? request.error : null, retry };
}
