import { useEffect, useState } from 'react';
import { Info } from 'lucide-react';
import { Badge, Button } from '../../shared/components/ui';
import { formatEscalationTime } from '../escalation/escalationRules';
import { agreeToCurrentPolicy, getAuthErrorMessage, getCurrentPolicyConsent } from './api/authApi';
import type { PolicyConsentResponse } from './api/authTypes';

export function PolicyConsentPanel() {
  const [consent, setConsent] = useState<PolicyConsentResponse | null>(null);
  const [required, setRequired] = useState(false);
  const [optional, setOptional] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    if (!getCurrentPolicyConsent) {
      setError('현재 동의 내역을 조회할 수 없습니다.');
      setLoading(false);
      return;
    }
    getCurrentPolicyConsent().then((response) => {
      if (!active) return;
      setConsent(response);
      setRequired(response.requiredAgreed);
      setOptional(response.optionalAgreed);
    }).catch((cause: unknown) => {
      if (active) setError(getAuthErrorMessage(cause, '동의 내역을 불러오지 못했습니다.'));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);

  const submit = async () => {
    if (!required || saving || !consent || !agreeToCurrentPolicy) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const response = await agreeToCurrentPolicy({ optionalAgreed: optional });
      setConsent(response);
      setRequired(response.requiredAgreed);
      setOptional(response.optionalAgreed);
      setSaved(true);
    } catch (cause) {
      setError(getAuthErrorMessage(cause, '동의 내용을 저장하지 못했습니다. 다시 시도해 주세요.'));
    } finally { setSaving(false); }
  };

  const hasChanges = Boolean(consent && (required !== consent.requiredAgreed || optional !== consent.optionalAgreed));
  const statusTitle = saving ? '동의 내용을 저장하고 있어요.'
    : saved ? '동의 내용이 저장되었습니다.'
      : hasChanges ? '변경한 동의 내용이 아직 저장되지 않았어요.'
        : consent?.requiredAgreed ? '필수 약관에 동의한 상태예요.' : '필수 약관 동의가 필요해요.';
  const statusDescription = saving ? '저장이 완료될 때까지 잠시 기다려 주세요.'
    : !required ? '아래 필수 항목의 내용을 확인하고 동의한 뒤 저장해 주세요.'
      : hasChanges ? '동의 내용 저장을 눌러 변경 사항을 적용해 주세요.'
        : '선택 동의는 아래에서 변경할 수 있어요.';

  return <div className="mypage-tab-content">
    <section aria-label="동의 현황" className="mypage-card mypage-consent-card">
      <div className="mypage-section-heading"><div><h2>동의 현황</h2><p>필수 약관과 선택 동의 내역을 관리하세요.</p></div></div>
      {loading ? <p className="mypage-consent-loading" role="status">동의 내역을 불러오고 있어요.</p> : consent ? <>
        <div className="mypage-notice mypage-consent-status" role="status">
          <Info aria-hidden="true" size={20} />
          <div><p className="mypage-consent-status-title">{statusTitle}</p><p>{statusDescription}</p></div>
        </div>
        <dl aria-label="저장된 동의 내역" className="mypage-consent-meta">
          <div><dt>정책 버전</dt><dd>{consent.policyVersion}</dd></div>
          <div><dt>동의 시점</dt><dd>{consent.agreedAt ? formatEscalationTime(consent.agreedAt) : '동의 내역 없음'}</dd></div>
          <div><dt>필수 동의</dt><dd>{consent.requiredAgreed ? '동의함' : '미동의'}</dd></div>
          <div><dt>선택 동의</dt><dd>{consent.optionalAgreed ? '동의함' : '미동의'}</dd></div>
        </dl>
        <form className="mypage-consent-form" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
          <fieldset className="mypage-consent-list">
            <legend>동의 항목</legend>
            <label className="mypage-consent-row">
              <input aria-describedby="mypage-required-consent-description" aria-labelledby="mypage-required-consent-title"
                checked={required} disabled={saving} onChange={(event) => { setRequired(event.target.checked); setSaved(false); }} required type="checkbox" />
              <span className="mypage-consent-copy">
                <span className="mypage-consent-title" id="mypage-required-consent-title"><Badge size="sm" variant="brand">필수</Badge><span>서비스 이용약관 및 개인정보 수집·이용 동의</span></span>
                <span className="mypage-consent-description" id="mypage-required-consent-description">계정 정보와 메시지·처리 기록을 서비스 제공 목적으로 수집·이용합니다.</span>
              </span>
            </label>
            <label className="mypage-consent-row">
              <input aria-describedby="mypage-optional-consent-description" aria-labelledby="mypage-optional-consent-title"
                checked={optional} disabled={saving} onChange={(event) => { setOptional(event.target.checked); setSaved(false); }} type="checkbox" />
              <span className="mypage-consent-copy">
                <span className="mypage-consent-title" id="mypage-optional-consent-title"><Badge size="sm">선택</Badge><span>서비스 개선을 위한 메시지 활용 동의</span></span>
                <span className="mypage-consent-description" id="mypage-optional-consent-description">AI 분석이 더 정확해지도록 작성한 메시지를 테스트 자료로 보관해 활용합니다. 선택 동의는 거부해도 서비스를 이용할 수 있습니다.</span>
              </span>
            </label>
          </fieldset>
          <div className="mypage-card-footer">
            <p id="mypage-consent-save-hint">{required ? '변경한 내용은 저장 후 적용됩니다.' : '필수 항목에 동의하면 저장할 수 있어요.'}</p>
            <Button aria-describedby="mypage-consent-save-hint" disabled={!required || saving} isLoading={saving} type="submit">{saving ? '저장 중…' : '동의 내용 저장'}</Button>
          </div>
        </form>
      </> : null}
      {error ? <div className="mypage-notice mypage-consent-error" role="alert"><Info aria-hidden="true" size={20} /><div><p>{error}</p>{!consent ? <Button onClick={() => setAttempt((value) => value + 1)} variant="outline">다시 불러오기</Button> : null}</div></div> : null}
    </section>
  </div>;
}
