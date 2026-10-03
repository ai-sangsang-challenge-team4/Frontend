import { Link } from 'react-router-dom';
import parentIllustration from '../../shared/assets/landing/parent.png';
import teacherIllustration from '../../shared/assets/landing/teacher.png';
import type { SignupRole } from '../../features/auth';

type RoleEntry = {
  role: SignupRole;
  title: string;
  summary: [string, string];
  image: string;
};

type LandingRoleGridProps = {
  ariaLabel?: string;
  linkState?: unknown;
};

const roleEntries: RoleEntry[] = [
  {
    role: 'TEACHER',
    title: '선생님 · 교직원',
    summary: ['학부모 메시지를 안전하게 확인하고,', '상황에 맞게 대응해보세요.'],
    image: teacherIllustration,
  },
  {
    role: 'PARENT',
    title: '학부모',
    summary: ['보내기 전 표현을 한 번 더 살피고,', '마음을 정확하게 전해보세요.'],
    image: parentIllustration,
  },
];

export function LandingRoleGrid({
  ariaLabel = '역할별 서비스 시작',
  linkState,
}: LandingRoleGridProps) {
  return (
    <div className="landing-role-grid" aria-label={ariaLabel}>
      {roleEntries.map((entry) => (
        <Link
          aria-label={`${entry.title} 로그인`}
          className="landing-role-card"
          key={entry.role}
          state={linkState}
          to={`/login?role=${entry.role}`}
        >
          <img
            className="landing-role-card__image"
            src={entry.image}
            alt=""
            aria-hidden="true"
          />
          <div className="landing-role-card__content">
            <h2>{entry.title}</h2>
            <p>
              {entry.summary[0]}
              <br />
              {entry.summary[1]}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
