import { useParams } from 'react-router-dom';
import { PageHeader } from '../../shared/components';

export function MessageReviewPage() {
  const { messageId } = useParams();

  return (
    <section className="page">
      <PageHeader eyebrow="Parent Review" title="수정안 검토" />
      <p className="route-meta">messageId: {messageId}</p>
    </section>
  );
}
