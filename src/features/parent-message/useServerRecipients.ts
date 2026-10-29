import { useCallback } from 'react';
import { useApiRequest } from '../../shared/api';
import { parentComplaintApi } from './api/parentComplaintApi';
import { listServerChildren, toServerRecipients, type ServerChild, type ServerRecipient } from './serverComplaint';

const none = () => Promise.resolve([]);

// Children and the selected child's teachers for the composer. Disabled (mock mode or a follow-up) it
// resolves to empty lists without a request.
export function useServerRecipients(enabled: boolean, studentId: number | undefined) {
  const children = useApiRequest<ServerChild[]>(useCallback((signal: AbortSignal) => (
    enabled ? listServerChildren(signal) : none()
  ), [enabled]));
  const recipients = useApiRequest<ServerRecipient[]>(useCallback((signal: AbortSignal) => (
    enabled && studentId ? parentComplaintApi.listRecipients(studentId, signal).then(toServerRecipients) : none()
  ), [enabled, studentId]));
  return { children, recipients };
}
