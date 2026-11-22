import { useCallback, useState } from 'react';
import { Check, CircleAlert, Info, LoaderCircle, Sparkles, TriangleAlert } from 'lucide-react';
import { getApiErrorMessage, useApiRequest } from '../../shared/api';
import { Accordion, Badge, Button, type BadgeVariant } from '../../shared/components/ui';
import type { RiskFactorStatus } from '../../shared/types';
import { maskContactInfo } from '../pii';
import { classificationStatusLabel, isProvisionalAnalysis } from '../risk-analysis';
import { getRiskTagNames } from '../risk-analysis/riskTagCatalog';
import { parentComplaintApi, type RiskDetection } from './api/parentComplaintApi';
import type { ParentMessageAnalysis } from './parentMessageTypes';
import { detectionConfidence, detectionEvidence, detectionSeverity, detectionState } from './riskDetectorResults';
import { riskTags } from './serverComplaint';

const stateVariant: Record<RiskFactorStatus, BadgeVariant> = {
  PRESENT: 'danger', ABSENT: 'neutral', BOUNDARY: 'warning', UNKNOWN: 'neutral',
};
const riskLabels = { LOW: '일반', MEDIUM: '주의', HIGH: '위험', EMERGENCY: '긴급' };
const riskVariants: Record<keyof typeof riskLabels, BadgeVariant> = {
  LOW: 'neutral', MEDIUM: 'warning', HIGH: 'danger', EMERGENCY: 'critical',
};
const riskMessages = {
  LOW: '분석된 내용을 확인해 주세요.',
  MEDIUM: '상대방에게 부담을 줄 수 있는 표현이 있어요.',
  HIGH: '상대방에게 위협이나 상처가 될 수 있는 표현이 있어요.',
  EMERGENCY: '안전과 관련해 긴급히 확인할 내용이 있어요.',
};
const analysisStatusLabels = {
  COMPLETED: '분석 완료', REUSED: '기존 AI 분석 재사용', REUSED_RULE_ONLY: '잠정 분석 재사용',
  RULE_ONLY_AI_UNAVAILABLE: 'AI 연결 장애', RULE_ONLY_INVALID_RESPONSE: 'AI 응답 검증 실패',
  SKIPPED_LIMIT: '분석 횟수 제한',
};
const safetyLabels = {
  credibleThreat: '구체적인 위해 위협', studentSafetyConcern: '학생 안전 위험', privacyExposure: '개인정보 노출 또는 유포 위험',
};

function DetectorResult({ label, result, isLlm = false }: { label: string; result: RiskDetection | null; isLlm?: boolean }) {
  const state = detectionState(result?.state, result?.detected);
  const evidence = detectionEvidence(result);
  return <div className="parent-detector-result">
    <p><strong>{label}</strong> <Badge size="sm" variant={stateVariant[state]}>{classificationStatusLabel[state]}</Badge></p>
    <p>신뢰도: {detectionConfidence(result?.confidence)}</p>
    {isLlm ? <>
      <p>심각도: {detectionSeverity(result)}</p>
      <p>{result?.repeatCount != null && Number.isInteger(result.repeatCount) && result.repeatCount >= 0
        ? `현재 민원에서 ${result.repeatCount}회 감지` : '반복 횟수 정보 없음'}</p>
    </> : null}
    {evidence.length > 0 ? evidence.map((text, index) => <blockquote key={index}>{maskContactInfo(text).text}</blockquote>)
      : <p>제공된 근거 구간이 없습니다.</p>}
  </div>;
}

export function ParentRiskAnalysisDetails({ analysis, analysisId }: { analysis: ParentMessageAnalysis; analysisId: number }) {
  const [openDetails, setOpenDetails] = useState<string[]>([]);
  const [openDetectors, setOpenDetectors] = useState<string[]>([]);
  const request = useCallback((signal: AbortSignal) => parentComplaintApi.getDetectorResults(analysisId, signal), [analysisId]);
  const { data, error, isLoading, retry } = useApiRequest(request);
  // Optional: the results show without waiting for the catalog.
  const { data: tagNames } = useApiRequest(getRiskTagNames);
  const emergencyOverride = analysis.emergencyOverride === undefined
    ? analysis.riskSummary?.emergencyOverride : analysis.emergencyOverride;
  const safetyFlags = data?.safetyFlags;
  const summary = analysis.riskSummary;
  const provisional = summary && isProvisionalAnalysis(summary);
  const skipped = summary?.aiAnalysisStatus === 'SKIPPED_LIMIT';
  // Display the server level as supplied; safety signals never recalculate it.
  const level = summary?.riskLevel;
  const signals = emergencyOverride?.applied === true && Array.isArray(emergencyOverride.safetySignals)
    ? emergencyOverride.safetySignals.filter((signal) => typeof signal?.code === 'string' && typeof signal.title === 'string') : [];
  const detectedSafety = (Object.keys(safetyLabels) as (keyof typeof safetyLabels)[])
    .filter((key) => safetyFlags?.[key] === true);
  const hasSafetyWarning = emergencyOverride?.applied === true || detectedSafety.length > 0;
  const hasThreat = safetyFlags?.credibleThreat === true || signals.some((signal) => signal.code === 'CREDIBLE_THREAT');
  // The threat is already explained in the heading and body. Keep other safety concerns visible once.
  const signalCodes = { studentSafetyConcern: 'STUDENT_SAFETY_CONCERN', privacyExposure: 'PRIVACY_EXPOSURE' };
  const safetyTitles = [...new Set([
    ...signals.filter((signal) => signal.code !== 'CREDIBLE_THREAT').map((signal) => signal.title),
    ...detectedSafety.filter((key) => key !== 'credibleThreat')
      .filter((key) => !signals.some((signal) => signal.code === signalCodes[key as keyof typeof signalCodes]))
      .map((key) => safetyLabels[key]),
  ])];
  const failed = analysis.status === 'failed' || (!skipped && Boolean(provisional));
  const pending = !failed && !skipped && analysis.revisionStatus === 'PENDING';
  const complete = !failed && !pending && !skipped &&
    (!summary?.aiAnalysisStatus || summary.aiAnalysisStatus === 'COMPLETED' || summary.aiAnalysisStatus === 'REUSED');
  const statusLabel = failed ? '분석 실패' : pending ? '분석 중' : complete ? '분석 완료'
    : skipped ? '분석 횟수 제한' : '분석 상태 확인 필요';
  const StatusIcon = failed ? CircleAlert : pending ? LoaderCircle : complete ? Check : Info;
  return <section aria-label="위험 분석 결과" className="parent-review-analysis-details">
    <header className="parent-review-analysis-header">
      <h2><Sparkles aria-hidden="true" size={20} />AI 분석 결과</h2>
      <span className={`parent-review-analysis-status${failed ? ' is-failed' : ''}`} role="status">
        <StatusIcon aria-hidden="true" className={pending ? 'parent-review-analysis-spinner' : undefined} size={16} />
        {statusLabel}
      </span>
    </header>
    <div className="parent-review-analysis-body">
    {provisional || (summary?.aiAnalysisStatus && summary.aiAnalysisStatus !== 'COMPLETED') ? <div className="parent-review-analysis-context">
      {provisional ? <Badge variant="warning" size="sm">잠정 분석</Badge> : null}
      {summary?.aiAnalysisStatus ? <span>{analysisStatusLabels[summary.aiAnalysisStatus] ?? '분석 상태 확인 필요'}</span> : null}
    </div> : null}
    {analysis.status === 'failed' ? <p className="parent-review-analysis-error">{level || hasSafetyWarning
      ? '분석 결과 일부를 불러오지 못했습니다. 아래는 이미 확인된 위험 정보입니다.'
      : '분석 결과를 불러오지 못했습니다. 원문을 확인해 주세요.'}</p> : null}
    {level || hasSafetyWarning ? <div className={`parent-review-risk-notice parent-review-risk-notice--${hasSafetyWarning ? 'EMERGENCY' : level}`}>
      {level === 'LOW' && !hasSafetyWarning ? <Info aria-hidden="true" size={20} /> : <TriangleAlert aria-hidden="true" size={20} />}
      <div>
        <div className="parent-review-risk-notice-heading">
          {level ? <Badge size="sm" variant={riskVariants[level]}>{riskLabels[level]}</Badge> : null}
          <strong>{hasThreat ? '상대방의 안전을 위협할 수 있는 표현이 감지됐어요.'
            : hasSafetyWarning ? riskMessages.EMERGENCY : level ? riskMessages[level] : null}</strong>
        </div>
        {safetyTitles.length > 0 ? <p className="parent-review-safety-summary">{safetyTitles.join(' · ')}</p> : null}
        <p>{hasThreat ? '구체적인 위해를 예고하는 표현이 포함되어 있습니다. ' : ''}전송 전 내용과 판단 근거를 다시 확인해 주세요.</p>
        {skipped ? <p>분석 횟수 제한으로 새 분석을 하지 못했습니다. 이전 결과는 현재 내용의 분석 결과가 아닙니다.</p>
          : provisional ? <p>AI 문맥 분석을 완료하지 못해 규칙 탐지 결과만 표시합니다.</p> : null}
        {summary?.manualReviewRequired ? <p>교사의 직접 검토가 필요합니다.</p> : null}
      </div>
    </div> : null}
    </div>
    <Accordion className="parent-review-analysis-accordion" value={openDetails} onValueChange={setOpenDetails} items={[{
      id: 'parent-analysis-details',
      title: <><span>상세 탐지 결과</span><span className="parent-review-details-action">{openDetails.length ? '접기' : '더보기'}</span></>,
      content: <>{isLoading ? <p role="status">상세 탐지 결과를 불러오고 있습니다.</p> : error ? <div role="alert">
        <p>{getApiErrorMessage(error, '상세 탐지 결과를 불러오지 못했습니다.')}</p>
        <Button onClick={retry} size="sm" variant="outline">다시 불러오기</Button>
      </div> : data ? <>
        {analysis.revisionReason ? <p><strong>수정 이유:</strong> {analysis.revisionReason}</p> : null}
        {safetyFlags == null ? <p>안전 신호 정보가 제공되지 않았습니다.</p>
          : (Object.keys(safetyLabels) as (keyof typeof safetyLabels)[]).map((key) => safetyFlags[key] == null
            ? <p key={key}>{safetyLabels[key]}: 미확인 — 현재 정보만으로 판단할 수 없습니다.</p> : null)}
        <Accordion allowMultiple className="parent-review-detectors" value={openDetectors} onValueChange={setOpenDetectors} items={data.results.map((result, index) => {
          const state = detectionState(result.finalState, result.finalDetected);
          return {
            id: `detector-${result.code}-${index}`,
            title: <span className="parent-detector-title"><strong>{analysis.risks.find((risk) => risk.id.startsWith(`${result.code}-`))?.title
              ?? tagNames?.[result.code] ?? riskTags[result.code]?.title ?? result.code}</strong>
              <Badge size="sm" variant={stateVariant[state]}>{classificationStatusLabel[state]}</Badge></span>,
            content: <>
              <DetectorResult label="규칙 분석" result={result.rule} />
              <DetectorResult isLlm label="AI 분석" result={result.llm} />
            </>,
          };
        })} />
        {data.results.length === 0 ? <p>제공된 상세 탐지 결과가 없습니다.</p> : null}
      </> : null}</>,
    }]} />
  </section>;
}
