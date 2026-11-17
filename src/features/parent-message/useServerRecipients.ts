import { useCallback } from 'react';
import { useApiRequest } from '../../shared/api';
import { parentComplaintApi } from './api/parentComplaintApi';
import { listServerChildren, toServerRecipients, type ServerChild, type ServerRecipient } from './serverComplaint';

const none = () => Promise.resolve([]);

// Keep linked-child names available for a locked initial draft. Its teacher is already fixed, so the
// teacher list can stop independently. Mock mode and follow-ups load neither list.
export function useServerRecipients(enabled: boolean, studentId: number | undefined, recipientsEnabled = enabled) {
  const children = useApiRequest<ServerChild[]>(useCallback((signal: AbortSignal) => (
    enabled ? listServerChildren(signal) : none()
  ), [enabled]));
  const recipients = useApiRequest<ServerRecipient[]>(useCallback((signal: AbortSignal) => (
    enabled && recipientsEnabled && studentId ? parentComplaintApi.listRecipients(studentId, signal).then(toServerRecipients) : none()
  ), [enabled, recipientsEnabled, studentId]));
  return { children, recipients };
}
