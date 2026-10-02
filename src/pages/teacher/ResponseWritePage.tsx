import { useParams } from 'react-router-dom';
import { PageHeader } from '../../shared/components';

export function ResponseWritePage() {
  const { messageId } = useParams();

  return (
    <section className="page">
      <PageHeader eyebrow="Teacher" title="답변 작성" />
      <p className="route-meta">messageId: {messageId}</p>
    </section>
  );
}
