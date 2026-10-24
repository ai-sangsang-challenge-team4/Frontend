import { useAuth } from '../../features/auth';
import { ParentMessageComposer } from '../../features/parent-message/ParentMessageComposer';

export function MessageWritePage() {
  const { user } = useAuth();

  return user ? <ParentMessageComposer key={user.userId} userId={user.userId} /> : null;
}
