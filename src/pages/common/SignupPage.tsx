import { type FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ROLE_LABEL,
  SIGNUP_ROLE_OPTIONS,
  getAuthErrorMessage,
  useAuth,
  type SignupRole,
} from '../../features/auth';
import { PasswordField } from '../../features/auth/components';
import { useEmailVerification } from '../../features/auth/hooks/useEmailVerification';
import { Button, TextField } from '../../shared/components/ui';

type SignupFormErrors = Partial<
  Record<
    | 'name'
    | 'password'
    | 'passwordConfirmation'
    | 'role'
    | 'submit'
    | 'verification',
    string
  >
>;

export function SignupPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isLoading, signup } = useAuth();
  const {
    developmentCode,
    email,
    emailError,
    formattedRemainingTime,
    hasRequestedVerification,
    isVerificationExpired,
    requestStatus,
    requestVerification,
    updateEmail,
    updateVerificationCode,
    verificationCode,
    verificationError,
    verificationStatus,
    verify,
  } = useEmailVerification();
  const [role, setRole] = useState<SignupRole>(() =>
    getInitialSignupRole(searchParams.get('role')),
  );
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [formErrors, setFormErrors] = useState<SignupFormErrors>({});

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isLoading) return;

    const nextErrors: SignupFormErrors = {};

    if (!name.trim()) {
      nextErrors.name = '이름을 입력해 주세요.';
    }

    if (!role) {
      nextErrors.role = '사용자 역할을 선택해 주세요.';
    }

    if (password.length < 8 || password.length > 20) {
      nextErrors.password = '비밀번호는 8자 이상 20자 이하로 입력해 주세요.';
    }

    if (password !== passwordConfirmation) {
      nextErrors.passwordConfirmation = '비밀번호가 일치하지 않습니다.';
    }

    if (verificationStatus !== 'verified') {
      nextErrors.verification = '이메일 인증을 완료해 주세요.';
    }

    setFormErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    try {
      await signup({
        email: email.trim(),
        name: name.trim(),
        password,
        role,
      });
      navigate('/login', {
        replace: true,
        state: {
          notice: '회원가입이 완료되었습니다. 로그인해 주세요.',
          registeredEmail: email.trim(),
        },
      });
    } catch (error) {
      setFormErrors({
        submit: getAuthErrorMessage(
          error,
          '회원가입에 실패했습니다. 잠시 후 다시 시도해 주세요.',
        ),
      });
    }
  };

  return (
    <section className="auth-screen auth-screen--signup" aria-labelledby="signup-title">
      <div className="auth-inner auth-inner--signup">
        <header className="auth-heading">
          <h1 id="signup-title">회원가입</h1>
          <p>간단한 회원가입 후, Teacher Hub 서비스를 이용해보세요.</p>
        </header>

        <form className="auth-form auth-form--signup" onSubmit={handleSubmit}>
          {formErrors.submit ? (
            <p className="auth-alert auth-alert--danger" role="alert">
              {formErrors.submit}
            </p>
          ) : null}

          <div className="auth-field-list">
            <fieldset className="auth-fieldset auth-fieldset--roles">
              <legend>
                사용자 역할 <span className="auth-required">*</span>
              </legend>
              <div className="auth-role-grid auth-role-grid--signup">
                {SIGNUP_ROLE_OPTIONS.map((option) => (
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
                      onChange={() => {
                        setRole(option);
                        setFormErrors((errors) => ({ ...errors, role: '' }));
                      }}
                      type="radio"
                      value={option}
                    />
                    <span className="auth-role-option__title">
                      {ROLE_LABEL[option]}
                    </span>
                    <span className="auth-role-option__meta">
                      {option === 'PARENT'
                        ? '메시지 작성 및 이력 확인'
                        : '메시지 검토 및 답변 작성'}
                    </span>
                  </label>
                ))}
              </div>
              {formErrors.role ? (
                <p className="auth-field-error" role="alert">
                  {formErrors.role}
                </p>
              ) : null}
            </fieldset>

            <TextField
              autoComplete="name"
              error={formErrors.name}
              fieldSize="lg"
              label={<RequiredLabel>이름</RequiredLabel>}
              name="name"
              onChange={(event) => {
                setName(event.target.value);
                setFormErrors((errors) => ({ ...errors, name: '', submit: '' }));
              }}
              placeholder="이름을 입력해주세요."
              value={name}
            />

            <div className="auth-stacked-field">
              <div className="auth-inline-row">
                <TextField
                  autoComplete="email"
                  error={emailError}
                  fieldSize="lg"
                  helperText="예: name@example.com"
                  label={<RequiredLabel>아이디</RequiredLabel>}
                  name="email"
                  onChange={(event) => {
                    updateEmail(event.target.value);
                    setFormErrors((errors) => ({
                      ...errors,
                      submit: '',
                      verification: '',
                    }));
                  }}
                  placeholder="이메일 형식으로 입력해주세요."
                  type="email"
                  value={email}
                />
                <Button
                  className="auth-inline-button"
                  disabled={requestStatus === 'loading' || verificationStatus === 'verified'}
                  isLoading={requestStatus === 'loading'}
                  onClick={requestVerification}
                  size="lg"
                  type="button"
                  variant="outline"
                >
                  {hasRequestedVerification ? '재전송' : '인증번호 받기'}
                </Button>
              </div>
              {developmentCode ? (
                <p className="auth-dev-code" role="status">
                  개발용 인증번호: <strong>{developmentCode}</strong>
                </p>
              ) : null}
            </div>

            <div className="auth-stacked-field">
              <div className="auth-inline-row">
                <TextField
                  autoComplete="one-time-code"
                  disabled={!hasRequestedVerification || verificationStatus === 'verified'}
                  error={
                    verificationStatus === 'verified'
                      ? undefined
                      : verificationError || formErrors.verification
                  }
                  fieldSize="lg"
                  inputMode="numeric"
                  label={<RequiredLabel>인증</RequiredLabel>}
                  maxLength={6}
                  name="verificationCode"
                  onChange={(event) => {
                    updateVerificationCode(event.target.value);
                    setFormErrors((errors) => ({
                      ...errors,
                      submit: '',
                      verification: '',
                    }));
                  }}
                  placeholder="인증번호를 입력해주세요."
                  trailingIcon={
                    hasRequestedVerification && verificationStatus !== 'verified' ? (
                      <span className="auth-verification-timer">
                        {formattedRemainingTime}
                      </span>
                    ) : undefined
                  }
                  value={verificationCode}
                />
                <Button
                  className="auth-inline-button"
                  disabled={
                    !hasRequestedVerification ||
                    isVerificationExpired ||
                    verificationStatus === 'verified'
                  }
                  isLoading={verificationStatus === 'loading'}
                  onClick={() => {
                    setFormErrors((errors) => ({
                      ...errors,
                      verification: '',
                    }));
                    void verify();
                  }}
                  size="lg"
                  type="button"
                  variant={verificationStatus === 'verified' ? 'secondary' : 'outline'}
                >
                  {verificationStatus === 'verified' ? '인증 완료' : '인증하기'}
                </Button>
              </div>
              {hasRequestedVerification ? (
                <ul className="auth-verification-help">
                  <li>
                    인증번호는 3분 이내에 입력해주세요.
                    <span className="sr-only">
                      {' '}남은 시간 {formattedRemainingTime}
                    </span>
                  </li>
                  {verificationStatus !== 'verified' ? (
                    <li>
                      인증번호를 받지 못하셨나요?{' '}
                      <button
                        className="auth-resend-button"
                        disabled={requestStatus === 'loading'}
                        onClick={requestVerification}
                        type="button"
                      >
                        재요청
                      </button>
                    </li>
                  ) : null}
                </ul>
              ) : null}
            </div>

            <PasswordField
              autoComplete="new-password"
              error={formErrors.password}
              fieldSize="lg"
              helperText="8자 이상 20자 이하로 입력해 주세요."
              label={<RequiredLabel>비밀번호</RequiredLabel>}
              maxLength={20}
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

            <PasswordField
              autoComplete="new-password"
              error={formErrors.passwordConfirmation}
              fieldSize="lg"
              label={<RequiredLabel>비밀번호 확인</RequiredLabel>}
              maxLength={20}
              name="passwordConfirmation"
              onChange={(event) => {
                setPasswordConfirmation(event.target.value);
                setFormErrors((errors) => ({
                  ...errors,
                  passwordConfirmation: '',
                  submit: '',
                }));
              }}
              placeholder="비밀번호를 다시 한 번 입력해주세요."
              value={passwordConfirmation}
            />
          </div>

          <div className="auth-submit-row">
            <Button
              className="auth-submit-button"
              isLoading={isLoading}
              size="lg"
              type="submit"
            >
              회원가입
            </Button>
          </div>
        </form>

        <nav className="auth-account-links" aria-label="계정 이동">
          <span>이미 계정이 있으신가요?</span>
          <Link to="/login">로그인</Link>
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

function getInitialSignupRole(roleParam: string | null): SignupRole {
  return roleParam === 'TEACHER' ? 'TEACHER' : 'PARENT';
}
