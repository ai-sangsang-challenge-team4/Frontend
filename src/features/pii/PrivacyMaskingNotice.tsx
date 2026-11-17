import { ShieldAlert } from 'lucide-react';
import { Badge, Button, InformationTooltip } from '../../shared/components/ui';
import type { MaskingResult } from './masking';
import './PrivacyMaskingNotice.css';

export function PrivacyMaskingNotice({ result, onRetry, compact = false }: {
  result: MaskingResult;
  onRetry?: () => void;
  compact?: boolean;
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
  const title = hasPersonalInfo ? '개인정보가 포함되어 있습니다.'
    : compact ? '개인정보를 확인해 주세요.' : '탐지된 전화번호·이메일·주민등록번호가 없습니다.';
  return (
    <section aria-label="개인정보 마스킹 상태" className={`privacy-masking-notice${hasPersonalInfo ? ' has-personal-info' : ''}`}>
      <div className="privacy-masking-heading">
        <svg aria-hidden="true" focusable="false" width={22} height={22} viewBox="0 0 24 24" fill="var(--color-bg-icon)">
          <path d="M9.51,11.99Q8.5,10.98 8.5,9.5q0-1.48 1.01-2.49T12,6t2.49,1.01T15.5,9.5t-1.01,2.49T12,13q-1.47,0-2.49-1.01Zm3.56-1.41Q13.5,10.15 13.5,9.5T13.08,8.42T12,8T10.93,8.42T10.5,9.5t0.43,1.07T12,11t1.08-0.43ZM12,22q-3.47-0.88-5.74-3.99T4,11.1V5l8-3l8,3v6.1q0,3.8-2.26,6.91T12,22Zm0-10Zm0-7.88L6,6.38V11.1q0,1.35 0.38,2.63t1.03,2.4Q8.45,15.6 9.6,15.3T12,15t2.4,0.3t2.2,0.83q0.65-1.13 1.02-2.4T18,11.1V6.38L12,4.13ZM10.25,17.2Q9.4,17.4 8.63,17.75q0.72,0.75 1.58,1.3T12,19.9q0.95-0.3 1.8-0.85t1.57-1.3Q14.6,17.4 13.75,17.2T12,17t-1.75,0.2Z" />
        </svg>
        {compact ? <span className="privacy-masking-description">
          <strong>{title}</strong>
          <InformationTooltip label="개인정보 확인 범위" content="전화번호·이메일·주민등록번호를 자동으로 확인합니다. 이름·주소 등 다른 개인정보가 포함되어 있는지도 직접 확인해 주세요." />
        </span> : <strong>{title}</strong>}
        {hasPersonalInfo ? <Badge variant="warning">{result.count}건 마스킹</Badge> : null}
      </div>
      {hasPersonalInfo || !compact ? <p>{hasPersonalInfo
        ? 'AI 분석과 전송에는 전화번호·이메일·주민등록번호를 가린 아래 문장을 사용합니다.'
        : '이름·주소 등 다른 개인정보가 포함되어 있는지도 직접 확인해 주세요.'}</p> : null}
      {hasPersonalInfo ? (
        <>
          <details className="privacy-masking-preview">
            <summary>마스킹 결과 보기</summary>
            <p>{result.text}</p>
          </details>
          {!compact ? <p className="privacy-masking-hint">현재 자동 탐지 대상은 전화번호, 이메일, 주민등록번호입니다. 이름·주소 등 다른 개인정보는 직접 확인해 주세요.</p> : null}
        </>
      ) : null}
    </section>
  );
}
