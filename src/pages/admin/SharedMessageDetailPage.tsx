import { useParams } from 'react-router-dom';
import { PageHeader } from '../../shared/components';

export function SharedMessageDetailPage() {
  const { messageId } = useParams();

  return (
    <section className="page">
      <PageHeader eyebrow="Admin" title="공유 메시지 상세" />
      <p className="route-meta">messageId: {messageId}</p>
    </section>
  );
}
