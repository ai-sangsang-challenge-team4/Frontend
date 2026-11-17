import { Accordion, Badge, type BadgeVariant } from '../../shared/components/ui';
import type { RiskFactorStatus } from '../../shared/types/risk';
import { classificationStatusLabel, getRiskClassifications, type RiskClassification } from './index';

const statusVariant: Record<RiskFactorStatus, BadgeVariant> = {
  PRESENT: 'danger', ABSENT: 'neutral', BOUNDARY: 'warning', UNKNOWN: 'neutral',
};

export function RiskClassificationSummary({ results }: { results?: RiskClassification[] }) {
  const classifications = getRiskClassifications(results);
  const statuses: RiskFactorStatus[] = ['PRESENT', 'BOUNDARY', 'UNKNOWN', 'ABSENT'];
  return <div aria-label="위험 요소 분류 요약" className="board-risk-classification-summary" role="group">
    {statuses.map((status) => {
      const count = classifications.filter((result) => result.status === status).length;
      return count ? <Badge key={status} size="sm" variant={statusVariant[status]}>{classificationStatusLabel[status]} {count}개</Badge> : null;
    })}
  </div>;
}

export function RiskClassificationPanel({
  canInspectOriginal, onOriginalOpen, results,
}: {
  canInspectOriginal: boolean;
  onOriginalOpen: (evidence?: string) => void;
  results?: RiskClassification[];
}) {
  return (
    <section aria-label="8개 위험 요소 분류" className="board-risk-classifications">
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
              <strong>판단 이유</strong>
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
