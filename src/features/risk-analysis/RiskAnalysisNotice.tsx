import { useId } from 'react';
import { Info } from 'lucide-react';
import { Badge } from '../../shared/components/ui';
import type { EmergencyOverride, RiskAnalysisMetadata, SafetyFlags } from '../../shared/types/risk';
import { isProvisionalAnalysis } from './index';
import './RiskAnalysisNotice.css';

const statusLabels = {
  COMPLETED: 'AI 분석 완료',
  REUSED: '기존 AI 분석 재사용',
  REUSED_RULE_ONLY: '잠정 분석 재사용',
  RULE_ONLY_AI_UNAVAILABLE: 'AI 연결 장애',
  RULE_ONLY_INVALID_RESPONSE: 'AI 응답 검증 실패',
  SKIPPED_LIMIT: '분석 횟수 제한',
};

export function RiskAnalysisNotice({ metadata, audience }: {
  metadata: RiskAnalysisMetadata;
  audience?: 'teacher';
}) {
  const headingId = useId();
  const { aiAnalysisStatus, manualReviewRequired, analysisMessage } = metadata;
  const skipped = aiAnalysisStatus === 'SKIPPED_LIMIT';
  const provisional = !skipped && isProvisionalAnalysis(metadata);
  if (!aiAnalysisStatus && !provisional && !manualReviewRequired) return null;
  if (audience === 'teacher' && (provisional || manualReviewRequired) && !skipped) {
    return <section className="risk-analysis-notice risk-analysis-notice--teacher-review" role="note" aria-labelledby={headingId}>
      <Info className="risk-analysis-notice-info-icon" size={20} aria-hidden="true" />
      <div>
        <h3 id={headingId}>교사의 직접 검토가 필요합니다</h3>
        <p>{provisional ? 'AI 문맥 분석을 완료하지 못해 규칙 탐지 결과를 바탕으로 위험도를 제공하고 있습니다. ' : ''}
          메시지 원문과 판단 근거를 확인한 후 위험도를 직접 검토해 주세요.</p>
      </div>
    </section>;
  }
  return <div className={`risk-analysis-notice${provisional || manualReviewRequired || skipped ? ' risk-analysis-notice--review' : ''}`} role="note">
    <div className="risk-analysis-notice-heading">
      {provisional ? <Badge variant="warning" size="sm">잠정 분석</Badge> : null}
      {aiAnalysisStatus ? <strong>{statusLabels[aiAnalysisStatus] ?? '분석 상태 확인 필요'}</strong> : null}
    </div>
    {skipped ? <p>분석 횟수 제한으로 새 분석 없이 전송되었습니다. 이전 결과는 이번 전송 내용의 새 분석 결과가 아닙니다.</p>
      : provisional ? <p>규칙 기반 잠정 위험도입니다. 원문과 판단 근거를 직접 검토해 주세요.</p> : null}
    {manualReviewRequired ? <p><strong>교사의 직접 검토가 필요합니다.</strong></p> : null}
    {typeof analysisMessage === 'string' && analysisMessage.trim() ? <p>{analysisMessage}</p> : null}
  </div>;
}

export function EmergencySafetySignals({ emergencyOverride }: { emergencyOverride: EmergencyOverride | null | undefined }) {
  const headingId = useId();
  if (emergencyOverride?.applied !== true) return null;

  const signals = Array.isArray(emergencyOverride.safetySignals)
    ? emergencyOverride.safetySignals.filter((signal) => typeof signal?.code === 'string' &&
      typeof signal.title === 'string' && typeof signal.description === 'string')
    : [];
  return <section aria-labelledby={headingId} className="risk-analysis-notice risk-analysis-notice--emergency">
    <h2 id={headingId}>긴급 안전 신호</h2>
    {signals.length > 0 ? <ul role="list">
      {signals.map((signal, index) => <li key={`${signal.code}-${index}`} data-signal-code={signal.code}>
        <div className="risk-analysis-notice-heading">
          <strong>{signal.title}</strong>
          <Badge variant="critical" size="sm">확인</Badge>
        </div>
        <p>{signal.description}</p>
      </li>)}
    </ul> : <p>긴급 승격 사유 상세가 제공되지 않았습니다.</p>}
  </section>;
}

const safetyLabels: Record<keyof SafetyFlags, string> = {
  credibleThreat: '구체적인 위해 위협',
  studentSafetyConcern: '학생 안전 위험',
  privacyExposure: '개인정보 노출 또는 유포 위험',
};

export function SafetyFlagsNotice({ flags, showEmergencyBadge }: {
  flags: SafetyFlags | null | undefined;
  showEmergencyBadge: boolean;
}) {
  if (flags && (Object.keys(safetyLabels) as (keyof SafetyFlags)[]).every((key) => flags[key] === false)) return null;
  return <section aria-label="안전 신호" className="risk-analysis-notice">
    <strong>안전 신호</strong>
    {flags == null ? <p>안전 신호 정보가 제공되지 않았습니다. 기존 분석 또는 규칙 기반 분석에서는 확인할 수 없습니다.</p>
      : (Object.keys(safetyLabels) as (keyof SafetyFlags)[]).map((key) => (
        flags[key] === false ? null : <p className={flags[key] === true ? 'risk-analysis-safety-alert' : undefined} key={key}>
          {flags[key] === true ? <><Badge variant={showEmergencyBadge ? 'critical' : 'warning'} size="sm">
            {showEmergencyBadge ? '긴급 안전 신호' : '감지'}
          </Badge> {safetyLabels[key]}이 감지되었습니다.</>
            : <>{safetyLabels[key]}: 현재 정보만으로 안전 신호를 판단할 수 없습니다. 추가 검토가 필요합니다.</>}
        </p>
      ))}
  </section>;
}
