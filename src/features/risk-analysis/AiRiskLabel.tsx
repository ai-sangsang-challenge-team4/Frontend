import { InformationTooltip } from '../../shared/components/ui';
import type { RiskAnalysisMetadata } from '../../shared/types/risk';
import { isProvisionalAnalysis } from './index';

export function AiRiskLabel({ metadata, score, audience }: {
  metadata: RiskAnalysisMetadata;
  score?: number | null;
  audience?: 'teacher';
}) {
  const provisional = isProvisionalAnalysis(metadata);
  if (provisional && audience === 'teacher') {
    return <span className="board-card-meta-label">
      규칙 기반 위험도
      <InformationTooltip label="규칙 기반 위험도란?" content={<span className="board-risk-score-help">
        <strong>규칙 기반 위험도란?</strong><br />
        사전에 정의된 규칙으로 탐지한 위험 요소를 반영한 결과입니다.<br />
        문맥에 따른 위험 요소가 반영되지 않았을 수 있으므로, 최종 판단은 교사가 직접 확인해야 합니다.
      </span>} />
    </span>;
  }
  const description = provisional
    ? 'AI 문맥 분석을 사용하지 못해 규칙만으로 산정한 잠정 위험도입니다. 원문과 판단 근거를 직접 검토한 뒤 최종 대응을 결정해 주세요.'
    : 'AI 시스템이 메시지의 위험 표현과 문맥을 분석하고 규칙 기반 결과와 함께 산정한 위험도입니다. AI 판단은 참고 정보이며, 최종 대응은 담당자의 검토를 거쳐 결정됩니다.';

  return <span className="board-card-meta-label">
    {provisional ? '규칙 기반 잠정 위험도' : 'AI 분석 위험도'}
    <InformationTooltip label="AI 위험도 설명" content={<span className="board-risk-score-help">
      {description}{score != null ? ` 시스템 위험 점수: ${score}/100.` : ''}
    </span>} />
  </span>;
}
