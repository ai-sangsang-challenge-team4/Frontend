import { Link } from 'react-router-dom';
import { PageHeader } from '../../shared/components';

export function LandingPage() {
  return (
    <section className="page page--center">
      <PageHeader
        eyebrow="Teacher Hub"
        title="학부모 메시지부터 교사 응답까지 한 흐름으로 관리합니다"
        description="역할별 화면과 공통 메시지 도메인을 하나의 앱에서 다룹니다."
      />
      <div className="action-row" aria-label="역할별 시작 경로">
        <Link className="button-link" to="/parent">
          학부모
        </Link>
        <Link className="button-link" to="/teacher">
          교사
        </Link>
        <Link className="button-link" to="/admin">
          관리자
        </Link>
      </div>
    </section>
  );
}
