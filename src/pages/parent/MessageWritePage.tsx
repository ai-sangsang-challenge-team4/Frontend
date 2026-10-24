import { useAuth } from '../../features/auth';
import { ParentMessageComposer } from '../../features/parent-message/ParentMessageComposer';
import { useLocation, useParams } from 'react-router-dom';

export function MessageWritePage() {
  const { user } = useAuth();
  const { messageId } = useParams();
  const { search } = useLocation();
  const params = new URLSearchParams(search);

  return user ? <ParentMessageComposer key={`${user.userId}-${messageId ?? 'new'}-${search}`}
    userId={user.userId} threadId={messageId} draftId={params.get('draft') ?? undefined} fresh={params.has('fresh')} /> : null;
}
