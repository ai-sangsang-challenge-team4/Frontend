import { ChevronDown, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Badge, Button, InformationTooltip } from '../../shared/components/ui';
import type { MaskingResult } from './masking';
import './PrivacyMaskingNotice.css';

const privacyScope = '전화번호·이메일·주민등록번호와 확인된 학부모·자녀·교사 이름을 자동으로 가립니다. ‘이름:’ 또는 ‘성명:’으로 표시한 한글 이름도 가립니다. 다른 이름이나 주소는 직접 확인해 주세요.';
const serverPrivacyScope = '학생명·교사명·같은 학급 명부의 다른 학생 이름, 전화번호·이메일·주민등록번호, 학번·교직원번호를 가립니다. 명부에 없는 이름이나 주소는 직접 확인해 주세요.';

export function PrivacyMaskingNotice({ result, onRetry, compact = false, inline = false, serverStatus, onPreviewRetry }: {
  result: MaskingResult;
  onRetry?: () => void;
  compact?: boolean;
  inline?: boolean;
  serverStatus?: 'pending' | 'ready' | 'failed';
  onPreviewRetry?: () => void;
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
  const StatusIcon = hasPersonalInfo || serverStatus === 'failed' ? ShieldAlert : ShieldCheck;
  const scope = serverStatus ? serverPrivacyScope : privacyScope;
  const title = hasPersonalInfo ? '개인정보가 포함되어 있습니다.'
    : serverStatus === 'pending' ? '개인정보를 확인하고 있어요.'
    : serverStatus === 'failed' ? '서버 개인정보 확인을 완료하지 못했습니다.'
    : inline ? '개인정보가 포함되지 않았는지 확인해 주세요.'
      : compact ? '개인정보를 확인해 주세요.' : '탐지된 개인정보가 없습니다.';
  return (
    <section aria-label="개인정보 마스킹 상태" className={`privacy-masking-notice${hasPersonalInfo ? ' has-personal-info' : ''}`}>
      <div className="privacy-masking-heading">
        <StatusIcon aria-hidden="true" size={18} />
        <strong>{title}</strong>
        {hasPersonalInfo ? <Badge size="sm" variant="warning">{result.count}건 마스킹</Badge> : null}
        {compact ? <InformationTooltip label="개인정보 확인 범위" content={scope} /> : null}
      </div>
      {hasPersonalInfo && serverStatus === 'pending' ? <p role="status">학급 명부 기준으로 개인정보를 확인하고 있어요.</p> : null}
      {serverStatus === 'failed' ? <>
        {hasPersonalInfo ? <p role="status">같은 학급의 다른 학생 이름을 확인하려면 다시 시도해 주세요.</p> : null}
        <Button onClick={onPreviewRetry} size="sm" variant="outline">개인정보 확인 다시 시도</Button>
      </> : null}
      {!hasPersonalInfo && !compact && serverStatus !== 'pending' ? <p>다른 이름이나 주소가 포함되어 있는지 직접 확인해 주세요.</p> : null}
      {hasPersonalInfo ? (
        <>
          <details className="privacy-masking-preview">
            <summary>마스킹 결과 보기 <ChevronDown aria-hidden="true" size={16} /></summary>
            <p>{result.text}</p>
          </details>
          {!compact ? <p className="privacy-masking-hint">{scope}</p> : null}
        </>
      ) : null}
    </section>
  );
}
