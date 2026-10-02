import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getDefaultRolePath,
  ROLE_LABEL,
  useAuth,
} from '../../features/auth';
import { PageHeader } from '../../shared/components';
import type { UserRole } from '../../shared/types';

const ROLE_OPTIONS: UserRole[] = ['PARENT', 'TEACHER', 'ADMIN'];

export function LoginPage() {
  const [role, setRole] = useState<UserRole>('PARENT');
  const [email, setEmail] = useState('');
  const { login, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate(getDefaultRolePath(user.role), { replace: true });
    }
  }, [navigate, user]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextUser = login({
      role,
      email,
    });

    navigate(getDefaultRolePath(nextUser.role), { replace: true });
  };

  return (
    <section className="page auth-page">
      <PageHeader eyebrow="Account" title="로그인" description="계정 역할을 선택해 접속합니다." />

      <form className="auth-form" onSubmit={handleSubmit}>
        <fieldset className="auth-fieldset">
          <legend>역할</legend>
          <div className="auth-role-grid">
            {ROLE_OPTIONS.map((option) => (
              <label
                className={
                  role === option
                    ? 'auth-role-option auth-role-option--selected'
                    : 'auth-role-option'
                }
                key={option}
              >
                <input
                  checked={role === option}
                  name="role"
                  onChange={() => setRole(option)}
                  type="radio"
                  value={option}
                />
                <span className="auth-role-option__title">{ROLE_LABEL[option]}</span>
                <span className="auth-role-option__meta">{option}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="auth-field">
          <span>이메일</span>
          <input
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            type="email"
            value={email}
          />
        </label>

        <button className="button-link auth-submit" type="submit">
          로그인
        </button>
      </form>
    </section>
  );
}
