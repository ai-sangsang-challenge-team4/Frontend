import { type FormEvent, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  getAuthErrorMessage,
  getDefaultRolePath,
  isValidEmail,
  useAuth,
} from '../../features/auth';
import { PasswordField } from '../../features/auth/components';
import { Button, TextField } from '../../shared/components/ui';
import type { UserRole } from '../../shared/types';

type LoginFormErrors = Partial<Record<'email' | 'password' | 'submit', string>>;

type LoginLocationState = {
  from?: string;
  notice?: string;
  registeredEmail?: string;
};

export function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { authNotice, isLoading, login, user } = useAuth();
  const locationState = location.state as LoginLocationState | null;
  const [email, setEmail] = useState(locationState?.registeredEmail ?? '');
  const [password, setPassword] = useState('');
  const [formErrors, setFormErrors] = useState<LoginFormErrors>({});

  useEffect(() => {
    if (user) {
      navigate(getLoginRedirectPath(user.role, locationState?.from), { replace: true });
    }
  }, [locationState?.from, navigate, user]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isLoading) return;

    const nextErrors: LoginFormErrors = {};

    if (!isValidEmail(email)) {
      nextErrors.email = '이메일 형식으로 입력해 주세요.';
    }

    if (!password) {
      nextErrors.password = '비밀번호를 입력해 주세요.';
    }

    setFormErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    try {
      await login({
        email: email.trim(),
        password,
      });
    } catch (error) {
      setFormErrors({
        submit: getAuthErrorMessage(
          error,
          '로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.',
        ),
      });
    }
  };

  return (
    <section className="auth-screen" aria-labelledby="login-title">
      <div className="auth-inner auth-inner--login">
        <header className="auth-heading">
          <h1 id="login-title">로그인</h1>
          <p>가입 시 사용한 이메일과 비밀번호로 로그인해주세요.</p>
        </header>

        <form className="auth-form auth-form--login" onSubmit={handleSubmit}>
          {authNotice ? (
            <p className="auth-alert auth-alert--danger" role="alert">
              {authNotice}
            </p>
          ) : null}
          {locationState?.notice ? (
            <p className="auth-alert auth-alert--success" role="status">
              {locationState.notice}
            </p>
          ) : null}
          {formErrors.submit ? (
            <p className="auth-alert auth-alert--danger" role="alert">
              {formErrors.submit}
            </p>
          ) : null}

          <div className="auth-field-list">
            <TextField
              autoComplete="email"
              error={formErrors.email}
              fieldSize="lg"
              label={<RequiredLabel>아이디</RequiredLabel>}
              name="email"
              onChange={(event) => {
                setEmail(event.target.value);
                setFormErrors((errors) => ({ ...errors, email: '', submit: '' }));
              }}
              placeholder="회원가입 시 설정한 아이디를 입력해주세요."
              type="email"
              value={email}
            />

            <PasswordField
              autoComplete="current-password"
              error={formErrors.password}
              fieldSize="lg"
              label={<RequiredLabel>비밀번호</RequiredLabel>}
              name="password"
              onChange={(event) => {
                setPassword(event.target.value);
                setFormErrors((errors) => ({
                  ...errors,
                  password: '',
                  submit: '',
                }));
              }}
              placeholder="비밀번호를 입력해주세요."
              value={password}
            />
          </div>

          <div className="auth-submit-row">
            <Button
              className="auth-submit-button"
              isLoading={isLoading}
              size="lg"
              type="submit"
            >
              로그인
            </Button>
          </div>
        </form>

        <nav className="auth-account-links" aria-label="계정 도움말">
          <Link to="/forgot-password">비밀번호 찾기</Link>
          <span aria-hidden="true">|</span>
          <Link to="/signup">회원가입</Link>
        </nav>
      </div>
    </section>
  );
}

function RequiredLabel({ children }: { children: string }) {
  return (
    <span>
      {children} <span className="auth-required">*</span>
    </span>
  );
}

function getLoginRedirectPath(role: UserRole, from?: string) {
  const defaultPath = getDefaultRolePath(role);

  if (!from) {
    return defaultPath;
  }

  return from === defaultPath || from.startsWith(`${defaultPath}/`) || from.startsWith(`${defaultPath}?`)
    ? from : defaultPath;
}
