import { useEffect, useRef, useState } from 'react';
import {
  getAuthErrorMessage,
  isValidEmail,
  sendEmailVerificationCode,
  verifyEmailCode,
} from '../api/authApi';

const VERIFICATION_DURATION_SECONDS = 180;

export type VerificationRequestStatus = 'idle' | 'loading';
export type VerificationStatus = 'idle' | 'loading' | 'verified';

export function useEmailVerification() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const [developmentCode, setDevelopmentCode] = useState('');
  const [hasRequestedVerification, setHasRequestedVerification] = useState(false);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const requestRevision = useRef(0);
  const [remainingSeconds, setRemainingSeconds] = useState(
    VERIFICATION_DURATION_SECONDS,
  );
  const [requestStatus, setRequestStatus] =
    useState<VerificationRequestStatus>('idle');
  const [verificationStatus, setVerificationStatus] =
    useState<VerificationStatus>('idle');

  useEffect(() => {
    if (
      !hasRequestedVerification ||
      expiresAt === null ||
      remainingSeconds === 0 ||
      verificationStatus === 'verified'
    ) {
      return;
    }

    const timerId = window.setInterval(() => {
      setRemainingSeconds(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [expiresAt, hasRequestedVerification, remainingSeconds, verificationStatus]);

  const updateEmail = (value: string) => {
    requestRevision.current += 1;
    setEmail(value);
    setEmailError('');
    setVerificationCode('');
    setVerificationError('');
    setDevelopmentCode('');
    setHasRequestedVerification(false);
    setExpiresAt(null);
    setRemainingSeconds(VERIFICATION_DURATION_SECONDS);
    setRequestStatus('idle');
    setVerificationStatus('idle');
  };

  const updateVerificationCode = (value: string) => {
    setVerificationCode(value.replace(/\D/g, '').slice(0, 6));
    setVerificationError('');
  };

  const requestVerification = async () => {
    if (requestStatus === 'loading') return;
    if (!isValidEmail(email)) {
      setEmailError('이메일 형식으로 입력해 주세요.');
      return;
    }

    setEmailError('');
    setVerificationError('');
    setRequestStatus('loading');
    const revision = ++requestRevision.current;

    try {
      const result = await sendEmailVerificationCode(email.trim());
      if (revision !== requestRevision.current) return;

      setVerificationCode('');
      setDevelopmentCode(result.code);
      setHasRequestedVerification(true);
      setExpiresAt(result.expiresAt);
      setRemainingSeconds(Math.max(0, Math.ceil((result.expiresAt - Date.now()) / 1000)));
      setVerificationStatus('idle');
    } catch (error) {
      if (revision !== requestRevision.current) return;
      setEmailError(
        getAuthErrorMessage(
          error,
          '인증번호를 전송하지 못했습니다. 잠시 후 다시 시도해 주세요.',
        ),
      );
    } finally {
      if (revision === requestRevision.current) setRequestStatus('idle');
    }
  };

  const verify = async () => {
    if (verificationStatus === 'loading') return;
    if (!hasRequestedVerification) {
      setVerificationError('인증번호를 먼저 요청해 주세요.');
      return;
    }

    if (expiresAt === null || Date.now() >= expiresAt) {
      setVerificationError('인증 시간이 만료되었습니다. 다시 요청해 주세요.');
      return;
    }

    if (!/^\d{6}$/.test(verificationCode)) {
      setVerificationError('6자리 인증번호를 입력해 주세요.');
      return;
    }

    setVerificationError('');
    setVerificationStatus('loading');
    const revision = requestRevision.current;

    try {
      await verifyEmailCode(email.trim(), verificationCode);
      if (revision !== requestRevision.current) return;
      setVerificationStatus('verified');
    } catch (error) {
      if (revision !== requestRevision.current) return;
      setVerificationStatus('idle');
      setVerificationError(
        getAuthErrorMessage(
          error,
          '인증번호를 확인하지 못했습니다. 다시 시도해 주세요.',
        ),
      );
    }
  };

  const formattedRemainingTime = `${Math.floor(remainingSeconds / 60)}:${(
    remainingSeconds % 60
  )
    .toString()
    .padStart(2, '0')}`;

  return {
    developmentCode,
    email,
    emailError,
    formattedRemainingTime,
    hasRequestedVerification,
    isVerificationExpired: remainingSeconds === 0,
    requestStatus,
    requestVerification,
    updateEmail,
    updateVerificationCode,
    verificationCode,
    verificationError,
    verificationStatus,
    verify,
  };
}
