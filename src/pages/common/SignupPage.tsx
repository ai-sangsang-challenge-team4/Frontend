import { type FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ROLE_LABEL,
  SIGNUP_ROLE_OPTIONS,
  getAuthErrorMessage,
  useAuth,
  type SignupRole,
} from '../../features/auth';
import { authApiMode, isEmailVerificationSupported } from '../../features/auth/api/authApi';
import { PasswordField } from '../../features/auth/components';
import { ChildInformationFields } from '../../features/auth/components/ChildInformationFields';
import { SchoolSearchField, type SelectedSchool } from '../../features/auth/components/SchoolSearchField';
import {
  createEmptyChildSignupInfo,
  validateChildSignupInfo,
  type ChildSignupErrors,
} from '../../features/auth/childSignup';
import { useEmailVerification } from '../../features/auth/hooks/useEmailVerification';
import { validateTeacherSignupInfo } from '../../features/auth/teacherSignup';
import { Button, TextField } from '../../shared/components/ui';

type SignupFormErrors = Partial<
  Record<
    | 'name'
    | 'schoolId'
    | 'employeeNo'
    | 'password'
    | 'passwordConfirmation'
    | 'policy'
    | 'role'
    | 'submit'
    | 'verification',
    string
  >
> & { child?: ChildSignupErrors };

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
  const [teacherSchool, setTeacherSchool] = useState<SelectedSchool>({ id: 0, displayName: '' });
  const [employeeNo, setEmployeeNo] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [child, setChild] = useState(createEmptyChildSignupInfo);
  const [policyAgreed, setPolicyAgreed] = useState(false);
  const [optionalAgreed, setOptionalAgreed] = useState(false);
  const [formErrors, setFormErrors] = useState<SignupFormErrors>({});

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isLoading) return;

    const nextErrors: SignupFormErrors = {};

    // Every role sends its own name; a teacher's must match the staff roster.
    if (!name.trim()) {
      nextErrors.name = '이름을 입력해 주세요.';
    }
    if (role === 'TEACHER') {
      Object.assign(nextErrors, validateTeacherSignupInfo({ schoolId: teacherSchool.id, employeeNo }));
    }

    if (!role) {
      nextErrors.role = '계정 유형을 선택해 주세요.';
    }

    if (password.length < 8 || password.length > 20) {
      nextErrors.password = '비밀번호는 8자 이상 20자 이하로 입력해 주세요.';
    }

    if (password !== passwordConfirmation) {
      nextErrors.passwordConfirmation = '비밀번호가 일치하지 않습니다.';
    }

    if (isEmailVerificationSupported && verificationStatus !== 'verified') {
      nextErrors.verification = '이메일 인증을 완료해 주세요.';
    }

    if (!policyAgreed) {
      nextErrors.policy = '필수 약관에 동의해 주세요.';
    }

    if (role === 'PARENT') {
      const childErrors = validateChildSignupInfo(child);
      if (Object.keys(childErrors).length > 0) nextErrors.child = childErrors;
    }

    setFormErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    try {
      await signup({
        email: email.trim(),
        password,
        name: name.trim(),
        policyAgreed,
        optionalAgreed,
        ...(role === 'PARENT'
          ? { role, child: { ...child, name: child.name.trim() } }
          : { role, schoolId: teacherSchool.id, employeeNo: employeeNo.trim() }),
      });
      navigate(`/login?role=${role}`, {
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
          <h1 id="signup-title">{ROLE_LABEL[role]} 회원가입</h1>
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
                계정 유형 <span className="auth-required">*</span>
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
                        setFormErrors((errors) => ({
                          ...errors, name: '', schoolId: '', employeeNo: '', role: '', child: undefined, submit: '',
                        }));
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

            {role === 'PARENT' ? (
              <ChildInformationFields
                disabled={isLoading}
                errors={formErrors.child}
                onChange={(nextChild) => {
                  setChild(nextChild);
                  setFormErrors((errors) => ({
                    ...errors,
                    child: errors.child ? validateChildSignupInfo(nextChild) : undefined,
                    submit: '',
                  }));
                }}
                value={child}
              />
            ) : null}

            {role === 'TEACHER' ? (
              <fieldset
                className="auth-fieldset auth-child-information auth-teacher-information"
                disabled={isLoading}
              >
                <legend className="auth-child-information__heading">
                  <span className="auth-child-information__title">
                    소속 정보 <span className="auth-required">*</span>
                  </span>
                  {authApiMode === 'mock' ? (
                    <span className="auth-child-information__notice">
                      학교 목록은 예시 데이터입니다.
                    </span>
                  ) : null}
                </legend>
                <div className="auth-child-information__fields">
                  <SchoolSearchField
                    disabled={isLoading}
                    error={formErrors.schoolId}
                    label="소속학교"
                    name="teacherSchool"
                    onSelect={(school) => {
                      setTeacherSchool(school);
                      setFormErrors((errors) => ({ ...errors, schoolId: '', submit: '' }));
                    }}
                    placeholder="소속학교를 검색해 주세요."
                    school={teacherSchool}
                  />
                  <TextField
                    aria-required="true"
                    autoComplete="off"
                    containerClassName="auth-child-row"
                    disabled={isLoading}
                    error={formErrors.employeeNo}
                    fieldSize="lg"
                    label="교번"
                    maxLength={100}
                    name="employeeNo"
                    onChange={(event) => {
                      setEmployeeNo(event.target.value);
                      setFormErrors((errors) => ({ ...errors, employeeNo: '', submit: '' }));
                    }}
                    placeholder="교번을 입력해 주세요."
                    value={employeeNo}
                  />
                </div>
              </fieldset>
            ) : null}

            {/* Every role sends the account holder's own name; a teacher's must match the staff roster. */}
            <TextField
              autoComplete="name"
              disabled={isLoading}
              error={formErrors.name}
              fieldSize="lg"
              helperText={role === 'PARENT' ? '자녀가 아닌 학부모 본인의 이름을 입력해 주세요.' : '교직원 명부에 등록된 이름을 입력해 주세요.'}
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
                  aria-describedby={!isEmailVerificationSupported ? 'signup-email-verification-notice' : undefined}
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
                  aria-describedby={!isEmailVerificationSupported ? 'signup-email-verification-notice' : undefined}
                  className="auth-inline-button"
                  disabled={!isEmailVerificationSupported || requestStatus === 'loading' || verificationStatus === 'verified'}
                  isLoading={requestStatus === 'loading'}
                  onClick={requestVerification}
                  size="lg"
                  type="button"
                  variant="outline"
                >
                  {hasRequestedVerification ? '재전송' : '인증번호 받기'}
                </Button>
              </div>
              {!isEmailVerificationSupported ? (
                <p className="auth-verification-notice" id="signup-email-verification-notice">
                  이메일 인증 기능은 준비 중이에요. 현재는 인증 없이 가입할 수 있어요.
                </p>
              ) : null}
              {developmentCode ? (
                <p className="auth-dev-code" role="status">
                  개발용 인증번호: <strong>{developmentCode}</strong>
                </p>
              ) : null}
            </div>

            {isEmailVerificationSupported ? (
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
            ) : null}

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

            {/* The spec's optional consent is test-data storage; the server records it as optionalAgreed. */}
            <fieldset className="auth-fieldset auth-consent">
              <legend>약관 동의</legend>
              <label className="auth-consent-option">
                <input
                  aria-describedby="signup-policy-description"
                  aria-invalid={formErrors.policy ? true : undefined}
                  checked={policyAgreed}
                  disabled={isLoading}
                  name="policyAgreed"
                  onChange={(event) => {
                    setPolicyAgreed(event.currentTarget.checked);
                    setFormErrors((errors) => ({ ...errors, policy: '', submit: '' }));
                  }}
                  type="checkbox"
                />
                <span>[필수] 서비스 이용약관 및 개인정보 수집·이용에 동의합니다.</span>
              </label>
              <p className="auth-consent-description" id="signup-policy-description">
                계정 정보와 메시지·처리 기록을 서비스 제공 목적으로 수집·이용합니다.
                동의하지 않으면 가입할 수 없습니다.
              </p>
              {formErrors.policy ? (
                <p className="auth-field-error" role="alert">
                  {formErrors.policy}
                </p>
              ) : null}
              <label className="auth-consent-option">
                <input
                  aria-describedby="signup-optional-description"
                  checked={optionalAgreed}
                  disabled={isLoading}
                  name="optionalAgreed"
                  onChange={(event) => setOptionalAgreed(event.currentTarget.checked)}
                  type="checkbox"
                />
                <span>[선택] 서비스 개선을 위한 메시지 활용에 동의합니다.</span>
              </label>
              <p className="auth-consent-description" id="signup-optional-description">
                AI 분석이 더 정확해지도록 작성한 메시지를 테스트 자료로 보관해 활용합니다.
                동의하지 않아도 모든 기능을 똑같이 이용할 수 있습니다.
              </p>
            </fieldset>
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
          <Link to={`/login?role=${role}`}>로그인</Link>
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
