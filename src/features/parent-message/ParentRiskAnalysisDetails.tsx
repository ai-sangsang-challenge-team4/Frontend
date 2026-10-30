import { useCallback } from 'react';
import { getApiErrorMessage, useApiRequest } from '../../shared/api';
import { Accordion, Badge, Button, type BadgeVariant } from '../../shared/components/ui';
import type { RiskFactorStatus } from '../../shared/types';
import { maskContactInfo } from '../pii';
import { toDisplayRiskScore } from '../escalation/escalationRules';
import { classificationStatusLabel } from '../risk-analysis';
import { getRiskTagNames } from '../risk-analysis/riskTagCatalog';
import { parentComplaintApi, type RiskDetection } from './api/parentComplaintApi';
import type { ParentMessageAnalysis } from './parentMessageTypes';
import { detectionConfidence, detectionEvidence, detectionState } from './riskDetectorResults';
import { riskTags } from './serverComplaint';

const stateVariant: Record<RiskFactorStatus, BadgeVariant> = {
  PRESENT: 'danger', ABSENT: 'neutral', BOUNDARY: 'warning', UNKNOWN: 'neutral',
};
const riskLabels = { LOW: '일반', MEDIUM: '주의', HIGH: '위험', EMERGENCY: '긴급' };

function DetectorResult({ label, result }: { label: string; result: RiskDetection | null }) {
  const state = detectionState(result?.state, result?.detected);
  const evidence = detectionEvidence(result);
  return <div className="parent-detector-result">
    <p><strong>{label}</strong> <Badge size="sm" variant={stateVariant[state]}>{classificationStatusLabel[state]}</Badge></p>
    <p>신뢰도: {detectionConfidence(result?.confidence)}</p>
    {evidence.length > 0 ? evidence.map((text, index) => <blockquote key={index}>{maskContactInfo(text).text}</blockquote>)
      : <p>제공된 근거 구간이 없습니다.</p>}
  </div>;
}

export function ParentRiskAnalysisDetails({ analysis, analysisId }: { analysis: ParentMessageAnalysis; analysisId: number }) {
  const request = useCallback(async (signal: AbortSignal) => {
    const [results, tagNames] = await Promise.all([
      parentComplaintApi.getDetectorResults(analysisId, signal), getRiskTagNames(signal),
    ]);
    return { ...results, tagNames };
  }, [analysisId]);
  const { data, error, isLoading, retry } = useApiRequest(request);
  return <section aria-label="위험 분석 결과" className="parent-review-analysis-details">
    {analysis.riskSummary ? <p className="parent-review-risk-score">
      위험도: <strong>{riskLabels[analysis.riskSummary.riskLevel]}</strong> · 위험 점수: {toDisplayRiskScore(analysis.riskSummary.riskScore)}점
    </p> : null}
    {analysis.revisionReason ? <p><strong>수정 이유:</strong> {analysis.revisionReason}</p> : null}
    {analysis.maskingContentVersion !== undefined ? <p>서버에서 개인정보 마스킹을 확인한 내용입니다.</p> : null}
    <details>
      <summary>상세 탐지 결과 보기</summary>
      {isLoading ? <p role="status">상세 탐지 결과를 불러오고 있습니다.</p> : error ? <div role="alert">
        <p>{getApiErrorMessage(error, '상세 탐지 결과를 불러오지 못했습니다.')}</p>
        <Button onClick={retry} size="sm" variant="outline">다시 불러오기</Button>
      </div> : data ? <>
        {data.llm ? <p>분석 모델: {data.llm.modelName} · 생성 다양성: {data.llm.temperature ?? '제공되지 않음'}</p> : null}
        <Accordion allowMultiple items={data.results.map((result, index) => {
          const state = detectionState(result.finalState, result.finalDetected);
          return {
            id: `detector-${result.code}-${index}`,
            title: <span className="parent-detector-title"><strong>{data.tagNames[result.code] ?? riskTags[result.code]?.title ?? result.code}</strong>
              <Badge size="sm" variant={stateVariant[state]}>{classificationStatusLabel[state]}</Badge></span>,
            content: <>
              <DetectorResult label="규칙 분석" result={result.rule} />
              <DetectorResult label="AI 분석" result={result.llm} />
            </>,
          };
        })} />
        {data.results.length === 0 ? <p>제공된 상세 탐지 결과가 없습니다.</p> : null}
      </> : null}
    </details>
  </section>;
}
