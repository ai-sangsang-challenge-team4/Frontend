import { Link } from 'react-router-dom';
import { PageHeader } from '../../shared/components';

export function NotFoundPage() {
  return (
    <section className="page page--center">
      <PageHeader eyebrow="404" title="페이지를 찾을 수 없습니다" />
      <Link className="button-link" to="/">
        홈으로 이동
      </Link>
    </section>
  );
}
