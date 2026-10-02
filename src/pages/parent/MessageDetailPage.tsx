import { useParams } from 'react-router-dom';
import { PageHeader } from '../../shared/components';

export function MessageDetailPage() {
  const { messageId } = useParams();

  return (
    <section className="page">
      <PageHeader eyebrow="Parent" title="메시지 상세" />
      <p className="route-meta">messageId: {messageId}</p>
    </section>
  );
}
