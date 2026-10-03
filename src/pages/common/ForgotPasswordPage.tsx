import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getAuthErrorMessage,
  isValidEmail,
  resetPassword,
  sendPasswordResetVerificationCode,
} from '../../features/auth/api/authApi';
import { PasswordField } from '../../features/auth/components';
import { Button, TextField } from '../../shared/components/ui';

type ForgotPasswordStep = 'email' | 'reset' | 'done';

type ResetFormErrors = Partial<
  Record<'email' | 'password' | 'passwordConfirmation' | 'submit' | 'verificationCode', string>
>;

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<ForgotPasswordStep>('email');
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [developmentCode, setDevelopmentCode] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [formErrors, setFormErrors] = useState<ResetFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleEmailSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isValidEmail(email)) {
      setFormErrors({ email: '이메일 형식으로 입력해 주세요.' });
      return;
    }

    setFormErrors({});
    setIsSubmitting(true);

    try {
      const result = await sendPasswordResetVerificationCode(email.trim());
      setDevelopmentCode(result.code);
      setStep('reset');
    } catch (error) {
      setFormErrors({
        submit: getAuthErrorMessage(
          error,
          '인증코드를 전송하지 못했습니다. 잠시 후 다시 시도해 주세요.',
        ),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors: ResetFormErrors = {};

    if (!/^\d{6}$/.test(verificationCode)) {
      nextErrors.verificationCode = '6자리 인증코드를 입력해 주세요.';
    }

    if (password.length < 8 || password.length > 20) {
      nextErrors.password = '비밀번호는 8자 이상 20자 이하로 입력해 주세요.';
    }

    if (password !== passwordConfirmation) {
      nextErrors.passwordConfirmation = '비밀번호가 일치하지 않습니다.';
    }

    setFormErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      await resetPassword({
        code: verificationCode,
        email: email.trim(),
        newPassword: password,
      });
      setStep('done');
    } catch (error) {
      setFormErrors({
        submit: getAuthErrorMessage(
          error,
          '비밀번호를 재설정하지 못했습니다. 잠시 후 다시 시도해 주세요.',
        ),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === 'done') {
    return (
      <section className="auth-screen auth-screen--result" aria-labelledby="forgot-done-title">
        <div className="auth-result">
          <h1 id="forgot-done-title">
            비밀번호 변경이
            <br />
            완료되었습니다.
          </h1>
          <Button
            className="auth-submit-button"
            onClick={() => navigate('/login', { replace: true })}
            size="lg"
            type="button"
          >
            로그인하기
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="auth-screen" aria-labelledby="forgot-password-title">
      <div className="auth-inner auth-inner--login">
        <header className="auth-heading">
          <h1 id="forgot-password-title">비밀번호 찾기</h1>
          <p>입력하신 인적사항으로 비밀번호를 찾을 수 있습니다.</p>
        </header>

        {step === 'email' ? (
          <form className="auth-form auth-form--login" onSubmit={handleEmailSubmit}>
            {formErrors.submit ? (
              <p className="auth-alert auth-alert--danger" role="alert">
                {formErrors.submit}
              </p>
            ) : null}

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
              placeholder="가입하신 이메일을 입력해 주세요."
              type="email"
              value={email}
            />

            <div className="auth-submit-row auth-submit-row--spacious">
              <Button
                className="auth-submit-button auth-submit-button--wide"
                isLoading={isSubmitting}
                size="lg"
                type="submit"
              >
                인증코드 전송하기
              </Button>
            </div>
          </form>
        ) : (
          <form className="auth-form auth-form--reset" onSubmit={handleResetSubmit}>
            {formErrors.submit ? (
              <p className="auth-alert auth-alert--danger" role="alert">
                {formErrors.submit}
              </p>
            ) : null}

            {developmentCode ? (
              <p className="auth-dev-code" role="status">
                개발용 인증코드: <strong>{developmentCode}</strong>
              </p>
            ) : null}

            <div className="auth-field-list auth-field-list--compact">
              <TextField
                autoComplete="one-time-code"
                error={formErrors.verificationCode}
                fieldSize="lg"
                inputMode="numeric"
                label={<RequiredLabel>인증코드</RequiredLabel>}
                maxLength={6}
                name="verificationCode"
                onChange={(event) => {
                  setVerificationCode(
                    event.target.value.replace(/\D/g, '').slice(0, 6),
                  );
                  setFormErrors((errors) => ({
                    ...errors,
                    submit: '',
                    verificationCode: '',
                  }));
                }}
                placeholder="이메일로 전송된 인증코드를 입력해주세요."
                value={verificationCode}
              />

              <PasswordField
                autoComplete="new-password"
                error={formErrors.password}
                fieldSize="lg"
                label={<RequiredLabel>새 비밀번호</RequiredLabel>}
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
                label={<RequiredLabel>새 비밀번호 확인</RequiredLabel>}
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
                isLoading={isSubmitting}
                size="lg"
                type="submit"
              >
                확인
              </Button>
            </div>
          </form>
        )}
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
