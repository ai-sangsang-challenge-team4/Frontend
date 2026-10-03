import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getDefaultRolePath, useAuth } from '../../features/auth';
import { PageHeader } from '../../shared/components';

export function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate(getDefaultRolePath(user.role), { replace: true });
    }
  }, [navigate, user]);

  return (
    <section className="page page--center">
      <PageHeader
        eyebrow="Teacher Hub"
        title="학부모 메시지부터 교사 응답까지 한 흐름으로 관리합니다"
        description="역할별 화면과 공통 메시지 도메인을 하나의 앱에서 다룹니다."
      />
      <div className="action-row landing-actions" aria-label="서비스 시작 경로">
        <Link className="button-link" to="/signup?role=PARENT">
          학부모로 시작
        </Link>
        <Link className="button-link" to="/signup?role=TEACHER">
          교사로 시작
        </Link>
        <Link className="text-button" to="/login">
          로그인
        </Link>
      </div>
    </section>
  );
}
