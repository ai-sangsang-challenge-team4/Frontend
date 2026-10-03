import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { EmptyState } from '../../../shared/components/ui';
import { getVisibleRiskFactors } from '../messageRules';
import type { BoardThread, RiskFactor } from '../types';
import { OriginalViewerIcon, RiskGuideIcon } from './MessageIcons';
import { RiskFactorIcon } from './RiskFactorDisplay';

type OriginalHighlightSegment = {
  end: number;
  factor: RiskFactor;
  start: number;
};

function getOriginalHighlightSegments(
  message: string,
  riskFactors: RiskFactor[],
) {
  const segments: OriginalHighlightSegment[] = [];

  riskFactors.forEach((factor) => {
    const evidence = factor.evidence.trim();

    if (!evidence) {
      return;
    }

    let searchStart = 0;
    let evidenceIndex = message.indexOf(evidence, searchStart);

    while (evidenceIndex >= 0) {
      const end = evidenceIndex + evidence.length;
      const isOverlapping = segments.some(
        (segment) => evidenceIndex < segment.end && end > segment.start,
      );

      if (!isOverlapping) {
        segments.push({
          end,
          factor,
          start: evidenceIndex,
        });
      }

      searchStart = end;
      evidenceIndex = message.indexOf(evidence, searchStart);
    }
  });

  return segments.sort((a, b) => a.start - b.start);
}

function renderHighlightedOriginalMessage({
  activeFactorId,
  message,
  onSelectRiskFactor,
  riskFactors,
}: {
  activeFactorId?: string;
  message: string;
  onSelectRiskFactor: (factorId: string) => void;
  riskFactors: RiskFactor[];
}): ReactNode {
  if (!message) {
    return '확인 가능한 원문이 없습니다.';
  }

  const segments = getOriginalHighlightSegments(message, riskFactors);

  if (segments.length === 0) {
    return message;
  }

  const nodes: ReactNode[] = [];
  let cursor = 0;

  segments.forEach((segment, index) => {
    if (cursor < segment.start) {
      nodes.push(message.slice(cursor, segment.start));
    }

    nodes.push(
      <button
        aria-label={`${segment.factor.name} 위험 표현 선택`}
        aria-pressed={activeFactorId === segment.factor.id}
        className={`board-original-highlight${
          activeFactorId === segment.factor.id ? ' is-active' : ''
        }`}
        key={`${segment.factor.id}-${segment.start}-${index}`}
        onClick={() => onSelectRiskFactor(segment.factor.id)}
        type="button"
      >
        {message.slice(segment.start, segment.end)}
      </button>,
    );

    cursor = segment.end;
  });

  if (cursor < message.length) {
    nodes.push(message.slice(cursor));
  }

  return nodes;
}

type OriginalMessageViewerProps = {
  selectedEvidence?: string;
  thread: BoardThread;
};

export function OriginalMessageViewer({
  selectedEvidence,
  thread,
}: OriginalMessageViewerProps) {
  const [isRiskListOpen, setIsRiskListOpen] = useState(true);
  const riskFactors = useMemo(() => getVisibleRiskFactors(thread), [thread]);
  const highlightedRiskFactors = useMemo(
    () =>
      riskFactors.filter(
        (factor) =>
          Boolean(factor.evidence.trim()) &&
          Boolean(thread.originalMessage?.includes(factor.evidence)),
      ),
    [riskFactors, thread.originalMessage],
  );
  const initialActiveFactorId =
    highlightedRiskFactors.find((factor) => factor.evidence === selectedEvidence)
      ?.id ??
    highlightedRiskFactors[0]?.id ??
    riskFactors[0]?.id;
  const [activeFactorId, setActiveFactorId] = useState<string | undefined>(
    initialActiveFactorId,
  );
  const [expandedFactorIds, setExpandedFactorIds] = useState<string[]>(
    initialActiveFactorId ? [initialActiveFactorId] : [],
  );
  const activeFactor = riskFactors.find(
    (factor) => factor.id === activeFactorId,
  );
  const detectedCount = highlightedRiskFactors.length || riskFactors.length;

  useEffect(() => {
    setActiveFactorId(initialActiveFactorId);
    setExpandedFactorIds(initialActiveFactorId ? [initialActiveFactorId] : []);
  }, [initialActiveFactorId, thread.id]);

  const expandAndSelectRiskFactor = (factorId: string) => {
    setActiveFactorId(factorId);
    setExpandedFactorIds((currentFactorIds) =>
      currentFactorIds.includes(factorId)
        ? currentFactorIds
        : [...currentFactorIds, factorId],
    );
  };

  const toggleRiskFactor = (factorId: string) => {
    setActiveFactorId(factorId);
    setExpandedFactorIds((currentFactorIds) =>
      currentFactorIds.includes(factorId)
        ? currentFactorIds.filter((currentFactorId) => currentFactorId !== factorId)
        : [...currentFactorIds, factorId],
    );
  };

  return (
    <div className="board-original-viewer">
      <div className="board-info-box board-original-viewer-info">
        <span aria-hidden="true">i</span>
        <p>
          원문은 학부모가 최종 전송한 내용입니다.
          <br />
          하이라이트된 표현을 선택해 탐지된 위험 요소와 판단 이유를 확인해
          주세요.
        </p>
      </div>

      <section
        aria-labelledby="board-original-message-title"
        className="board-original-viewer-panel board-original-message-panel"
      >
        <div className="board-original-viewer-header">
          <div>
            <OriginalViewerIcon className="board-original-viewer-title-icon" />
            <h2 id="board-original-message-title">원문 확인</h2>
          </div>
        </div>
        <p className="board-original-viewer-message">
          {renderHighlightedOriginalMessage({
            activeFactorId,
            message: thread.originalMessage ?? '',
            onSelectRiskFactor: expandAndSelectRiskFactor,
            riskFactors,
          })}
        </p>
      </section>

      <section
        aria-labelledby="board-original-risk-title"
        className="board-original-viewer-panel board-original-risk-panel"
      >
        <div className="board-original-viewer-header">
          <div>
            <RiskGuideIcon className="board-original-risk-title-icon" />
            <h2 id="board-original-risk-title">
              탐지된 위험 표현 목록 ({detectedCount})
            </h2>
          </div>
          <button
            aria-expanded={isRiskListOpen}
            className="board-outline-button board-original-risk-toggle"
            onClick={() => setIsRiskListOpen((isOpen) => !isOpen)}
            type="button"
          >
            <span>{isRiskListOpen ? '접기' : '펼치기'}</span>
            <svg
              aria-hidden="true"
              className={isRiskListOpen ? 'is-open' : ''}
              fill="none"
              viewBox="0 0 12 8"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M6 7.4 0 1.4 1.4 0 6 4.575 10.6 0 12 1.4 6 7.4Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>

        {isRiskListOpen ? (
          riskFactors.length > 0 ? (
            <div className="board-original-risk-list">
              {riskFactors.map((factor) => {
                const isExpanded = expandedFactorIds.includes(factor.id);

                return (
                  <article
                    className={`board-original-risk-card${
                      isExpanded ? ' is-expanded' : ''
                    }`}
                    key={factor.id}
                  >
                    <button
                      aria-expanded={isExpanded}
                      className="board-original-risk-card-trigger"
                      onClick={() => toggleRiskFactor(factor.id)}
                      type="button"
                    >
                      <span className="board-original-risk-card-title">
                        <RiskFactorIcon factor={factor} />
                        <strong>{factor.name}</strong>
                      </span>
                      <svg
                        aria-hidden="true"
                        className={isExpanded ? 'is-open' : ''}
                        fill="none"
                        viewBox="0 0 12 8"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M6 7.4 0 1.4 1.4 0 6 4.575 10.6 0 12 1.4 6 7.4Z"
                          fill="currentColor"
                        />
                      </svg>
                    </button>
                    {factor.evidence ? (
                      <button
                        className="board-original-risk-evidence"
                        onClick={() => expandAndSelectRiskFactor(factor.id)}
                        type="button"
                      >
                        <span
                          aria-hidden="true"
                          className="board-original-risk-evidence-marker"
                        />
                        <span className="board-original-highlight">
                          “{factor.evidence}”
                        </span>
                      </button>
                    ) : null}
                    {isExpanded ? (
                      <div className="board-original-risk-detail">
                        <div>
                          <strong>설명</strong>
                          <p>{factor.description}</p>
                        </div>
                        <div>
                          <strong>판단 근거</strong>
                          <p>{factor.rationale}</p>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState
              className="board-risk-empty board-risk-factor-empty"
              description="이 메시지에서는 별도 위험 요소가 감지되지 않았습니다."
              title="없음"
            />
          )
        ) : activeFactor ? (
          <p className="board-original-risk-collapsed">
            선택된 표현: “{activeFactor.evidence || activeFactor.name}”
          </p>
        ) : null}
      </section>
    </div>
  );
}
