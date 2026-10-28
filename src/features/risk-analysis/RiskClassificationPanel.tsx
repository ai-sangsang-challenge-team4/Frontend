import { Accordion, Badge, type BadgeVariant } from '../../shared/components/ui';
import type { RiskFactorStatus } from '../../shared/types/risk';
import { classificationStatusLabel, getRiskClassifications, type RiskClassification } from './index';

const statusVariant: Record<RiskFactorStatus, BadgeVariant> = {
  PRESENT: 'danger', ABSENT: 'neutral', BOUNDARY: 'warning', UNKNOWN: 'neutral',
};

export function RiskClassificationPanel({
  canInspectOriginal, onOriginalOpen, results,
}: {
  canInspectOriginal: boolean;
  onOriginalOpen: (evidence?: string) => void;
  results?: RiskClassification[];
}) {
  return (
    <section aria-label="8개 위험 요소 분류" className="board-risk-classifications">
      <h3>8개 위험 요소 분류</h3>
      <p>각 항목을 펼쳐 판단 이유와 근거 구간을 확인할 수 있습니다. 미확인은 분석 결과가 제공되지 않은 상태입니다.</p>
      <Accordion
        allowMultiple
        className="board-classification-accordion"
        items={getRiskClassifications(results).map((result) => ({
          id: `classification-${result.code}`,
          title: (
            <span className="board-classification-title">
              <strong>{result.label}</strong>
              <Badge size="sm" variant={statusVariant[result.status]}>{classificationStatusLabel[result.status]}</Badge>
            </span>
          ),
          content: (
            <div className="board-risk-factor-detail">
              <p>{result.status === 'UNKNOWN'
                ? '이 항목의 분류 결과를 확인하지 못했습니다.'
                : result.rationale || (result.status === 'ABSENT' ? '이 위험 요소는 탐지되지 않았습니다.' : '판단 이유가 제공되지 않았습니다.')}</p>
              {result.status === 'PRESENT' || result.status === 'BOUNDARY' ? (
                canInspectOriginal ? (
                  result.evidenceSpan?.trim() ? (
                    <>
                      <blockquote className="board-factor-evidence"><strong>근거 구간</strong><p>“{result.evidenceSpan}”</p></blockquote>
                      <button className="board-outline-button" onClick={() => onOriginalOpen(result.evidenceSpan ?? undefined)} type="button">원문에서 근거 확인</button>
                    </>
                  ) : <p>제공된 근거 구간이 없습니다.</p>
                ) : <p>원문 열람 권한이 없거나 원문이 제공되지 않아 근거 구간을 표시할 수 없습니다.</p>
              ) : null}
            </div>
          ),
        }))}
      />
    </section>
  );
}
