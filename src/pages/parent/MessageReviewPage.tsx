import { useParams } from 'react-router-dom';
import { useAuth } from '../../features/auth';
import { ParentMessageReview } from '../../features/parent-message/ParentMessageReview';

export function MessageReviewPage() {
  const { messageId } = useParams();
  const { user } = useAuth();

  return user && messageId ? <ParentMessageReview key={`${user.userId}-${messageId}`} messageId={messageId} userId={user.userId} /> : null;
}
