import { useCallback } from 'react';
import { useApiRequest } from '../../shared/api';
import { parentComplaintApi } from './api/parentComplaintApi';
import { listServerChildren, toServerRecipients, type ServerChild, type ServerRecipient } from './serverComplaint';

const none = () => Promise.resolve([]);

export function useServerChildren(enabled: boolean) {
  return useApiRequest<ServerChild[]>(useCallback((signal: AbortSignal) => (
    enabled ? listServerChildren(signal) : none()
  ), [enabled]));
}

// A locked draft can still need its child's name even when the teacher is fixed.
export function useServerRecipients(enabled: boolean, studentId: number | undefined, recipientsEnabled = enabled) {
  const children = useServerChildren(enabled);
  const recipients = useApiRequest<ServerRecipient[]>(useCallback((signal: AbortSignal) => (
    enabled && recipientsEnabled && studentId ? parentComplaintApi.listRecipients(studentId, signal).then(toServerRecipients) : none()
  ), [enabled, recipientsEnabled, studentId]));
  return { children, recipients };
}
