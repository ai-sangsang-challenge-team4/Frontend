import { useParams } from 'react-router-dom';
import { useAuth } from '../../features/auth';
import { ParentMessageReceipt } from '../../features/parent-message/ParentMessageReceipt';

export function MessageDetailPage() {
  const { messageId } = useParams();
  const { user } = useAuth();

  return user && messageId ? <ParentMessageReceipt key={`${user.userId}-${messageId}`} messageId={messageId} userId={user.userId} /> : null;
}
