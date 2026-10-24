import { useParams } from 'react-router-dom';
import { AdminSharedMessageDetail } from '../../features/admin';

export function SharedMessageDetailPage() {
  const { messageId = '' } = useParams();

  // key resets tab and memo state when moving between shared messages.
  return <AdminSharedMessageDetail complaintId={messageId} key={messageId} />;
}
