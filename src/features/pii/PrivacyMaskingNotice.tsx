import { LockKeyhole, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Badge, Button } from '../../shared/components/ui';
import type { MaskingResult } from './masking';
import './PrivacyMaskingNotice.css';

export function PrivacyMaskingNotice({ result, onRetry }: {
  result: MaskingResult;
  onRetry?: () => void;
}) {
  if (result.status === 'failed') {
    return (
      <section aria-label="개인정보 마스킹 상태" className="privacy-masking-notice is-failed">
        <div className="privacy-masking-heading" role="alert">
          <ShieldAlert aria-hidden="true" size={22} />
          <strong>개인정보 마스킹에 실패했습니다.</strong>
        </div>
        <p>개인정보 보호를 위해 AI 분석과 전송을 중단했습니다. 작성한 내용은 유지됩니다. 다시 시도하거나 개인정보를 직접 삭제해 주세요.</p>
        {onRetry ? <Button onClick={onRetry} size="sm" variant="outline">마스킹 다시 시도</Button> : null}
      </section>
    );
  }

  const hasPersonalInfo = result.count > 0;
  const Icon = hasPersonalInfo ? LockKeyhole : ShieldCheck;
  return (
    <section aria-label="개인정보 마스킹 상태" className={`privacy-masking-notice${hasPersonalInfo ? ' has-personal-info' : ''}`}>
      <div className="privacy-masking-heading">
        <Icon aria-hidden="true" size={22} />
        <strong>{hasPersonalInfo ? '개인정보가 포함되어 있습니다.' : '탐지된 전화번호·이메일·주민등록번호가 없습니다.'}</strong>
        {hasPersonalInfo ? <Badge variant="warning">{result.count}건 마스킹</Badge> : null}
      </div>
      <p>{hasPersonalInfo
        ? 'AI 분석과 전송에는 전화번호·이메일·주민등록번호를 가린 아래 문장을 사용합니다.'
        : '이름·주소 등 다른 개인정보가 포함되어 있는지도 직접 확인해 주세요.'}</p>
      {hasPersonalInfo ? (
        <>
          <details className="privacy-masking-preview">
            <summary>마스킹 결과 보기</summary>
            <p>{result.text}</p>
          </details>
          <p className="privacy-masking-hint">현재 자동 탐지 대상은 전화번호, 이메일, 주민등록번호입니다. 이름·주소 등 다른 개인정보는 직접 확인해 주세요.</p>
        </>
      ) : null}
    </section>
  );
}
