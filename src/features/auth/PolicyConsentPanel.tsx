import { useEffect, useState } from 'react';
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

  return <div className="mypage-tab-content">
    <section aria-label="동의 현황" className="mypage-card">
      <div className="mypage-section-heading"><div><h2>동의 현황</h2><p>현재 정책의 필수·선택 동의 여부를 확인하고 변경합니다.</p></div></div>
      {loading ? <p role="status">동의 내역을 불러오고 있어요.</p> : consent ? <>
        {!consent.requiredAgreed ? <p role="status">현재 정책에 대한 필수 동의가 필요합니다. 내용을 확인하고 동의해 주세요.</p> : null}
        <dl className="mypage-consent-meta">
          <div><dt>정책 버전</dt><dd>{consent.policyVersion}</dd></div>
          <div><dt>동의 시점</dt><dd>{consent.agreedAt ? formatEscalationTime(consent.agreedAt) : '동의 내역 없음'}</dd></div>
          <div><dt>필수 동의</dt><dd>{consent.requiredAgreed ? '동의함' : '미동의'}</dd></div>
          <div><dt>선택 동의</dt><dd>{consent.optionalAgreed ? '동의함' : '미동의'}</dd></div>
        </dl>
        <form onSubmit={(event) => { event.preventDefault(); void submit(); }}>
          <div className="mypage-consent-list">
            <label className="mypage-consent-row">
              <input checked={required} disabled={saving} onChange={(event) => { setRequired(event.target.checked); setSaved(false); }} required type="checkbox" />
              <span className="mypage-consent-copy">서비스 이용약관 및 개인정보 수집·이용 동의 <Badge size="sm" variant="brand">필수</Badge></span>
            </label>
            <label className="mypage-consent-row">
              <input checked={optional} disabled={saving} onChange={(event) => { setOptional(event.target.checked); setSaved(false); }} type="checkbox" />
              <span className="mypage-consent-copy">서비스 개선을 위한 메시지 활용 동의 <Badge size="sm">선택</Badge></span>
            </label>
          </div>
          <p className="mypage-muted">선택 동의는 거부해도 서비스를 이용할 수 있습니다. 필수 동의를 확인한 뒤 저장해 주세요.</p>
          <div className="mypage-card-footer"><Button disabled={!required || saving} type="submit">{saving ? '저장 중…' : '동의 내용 저장'}</Button></div>
        </form>
      </> : null}
      {error ? <div role="alert"><p>{error}</p>{!consent ? <Button onClick={() => setAttempt((value) => value + 1)} variant="outline">다시 불러오기</Button> : null}</div> : null}
      {saved ? <p role="status">동의 내용이 저장되었습니다.</p> : null}
    </section>
  </div>;
}
