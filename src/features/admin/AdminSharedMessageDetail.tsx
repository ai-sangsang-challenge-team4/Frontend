import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../../shared/api';
import { AsyncContent } from '../../shared/components';
import { Accordion, EmptyState } from '../../shared/components/ui';
import type { RiskLevel } from '../../shared/types';
import {
  getAdminEscalation,
  getAdminEscalationHistory,
  getAdminEscalationMessages,
  getAdminEscalationRisk,
} from '../escalation/api';
import { apiRiskTone, formatEscalationTime, historyEventLabel } from '../escalation/escalationRules';
import type {
  AdminEscalationSummaryResponse,
  ConversationMessage,
  DetectedFactor,
  HistoryEvent,
} from '../escalation/escalationTypes';
import { useEscalationRequest } from '../escalation/useEscalationRequest';
import { BreadcrumbSeparator, FileSearchIcon, RiskSectionIcon } from '../message/components/MessageIcons';
import { ProfileAvatar } from '../message/components/ProfileAvatar';
import { RiskBadge } from '../message/components/RiskBadge';
import { RiskFactorDetail, RiskFactorTitle } from '../message/components/RiskFactorDisplay';
import { riskLabel } from '../message/messageRules';
import type { RiskFactor } from '../message/types';
import { AdminProcessPanel } from './components/AdminProcessPanel';

type DetailTab = 'shared' | 'risk' | 'history';

const detailTabLabel: Record<DetailTab, string> = {
  shared: '공유 내용',
  risk: '위험 분석',
  history: '처리 기록',
};

const detailTabs: DetailTab[] = ['shared', 'risk', 'history'];

type AdminSharedMessageDetailProps = {
  escalationId: number;
};

// History events omit empty fields (@JsonInclude(NON_NULL)), so a score may be undefined as well as null.
function riskText(level: RiskLevel, score: number | null | undefined) {
  return score == null ? riskLabel[apiRiskTone[level]] : `${riskLabel[apiRiskTone[level]]}(${score}점)`;
}

export function AdminSharedMessageDetail({ escalationId }: AdminSharedMessageDetailProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<DetailTab>('shared');
  // A non-numeric route segment is a local not-found; nothing is requested.
  const request = useCallback(
    (signal: AbortSignal) => Number.isSafeInteger(escalationId) && escalationId > 0
      ? getAdminEscalation(escalationId, signal)
      : Promise.reject(new ApiError({ status: 404 })),
    [escalationId],
  );
  const { data, error, isInitialLoading, retry } = useEscalationRequest(request);
  const goToList = () => navigate('/admin/messages');

  return (
    <main className="board-detail-page">
      <section className="board-detail admin-detail" aria-labelledby="admin-detail-title">
        <header className="board-detail-page-header">
          <div className="board-detail-title-group">
            <button aria-label="목록으로 돌아가기" className="board-back-button" onClick={goToList} type="button">
              <svg aria-hidden="true" fill="none" viewBox="0 0 16 15" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M3.825 8.24079 9.425 13.3684 8 14.6503 0 7.32515 8 0l1.425 1.2819-5.6 5.1276H16v1.83129H3.825Z"
                  fill="currentColor"
                />
              </svg>
            </button>
            <h1 id="admin-detail-title">공유 메시지 상세</h1>
          </div>
          <nav aria-label="현재 위치" className="board-page-nav">
            <button onClick={goToList} type="button">홈</button>
            <BreadcrumbSeparator />
            <button onClick={goToList} type="button">공유받은 메시지</button>
            <BreadcrumbSeparator />
            <strong>{detailTabLabel[activeTab]}</strong>
          </nav>
        </header>

        <AsyncContent
          error={data ? null : error}
          homePath="/admin/messages"
          isLoading={isInitialLoading}
          loadingMessage="공유된 메시지를 불러오고 있어요."
          onRetry={retry}
        >
          {data ? (
            <>
              <AdminContextCard summary={data} />
              <AdminProcessPanel onConflict={retry} summary={data} />

              <nav aria-label="공유 메시지 상세 탭" className="board-detail-tabs">
                {detailTabs.map((tab) => (
                  <button
                    aria-current={activeTab === tab ? 'page' : undefined}
                    className={activeTab === tab ? 'is-active' : ''}
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    type="button"
                  >
                    {detailTabLabel[tab]}
                  </button>
                ))}
              </nav>

              {activeTab === 'shared' ? <SharedContentPanel escalationId={data.escalationId} /> : null}
              {activeTab === 'risk' ? <RiskAnalysisPanel escalationId={data.escalationId} /> : null}
              {activeTab === 'history' ? <HistoryPanel escalationId={data.escalationId} /> : null}
            </>
          ) : null}
        </AsyncContent>
      </section>
    </main>
  );
}

function AdminContextCard({ summary }: { summary: AdminEscalationSummaryResponse }) {
  return (
    <div className="board-parent-card">
      <div className="board-card-profile">
        <ProfileAvatar />
        <span>
          <strong>{summary.sharedBy}</strong>
          <small>공유 교사</small>
        </span>
      </div>
      <div className="board-card-topic">
        <strong>민원 #{summary.complaintId}</strong>
      </div>
      <div className="board-card-meta-group">
        <div className="board-card-meta">
          <span>위험도</span>
          <RiskBadge level={apiRiskTone[summary.currentRiskLevel]} />
        </div>
        <div className="board-card-meta">
          <span>공유 시각</span>
          <time dateTime={summary.sharedAt}>{formatEscalationTime(summary.sharedAt)}</time>
        </div>
      </div>
    </div>
  );
}

function SharedContentPanel({ escalationId }: { escalationId: number }) {
  const request = useCallback(
    (signal: AbortSignal) => getAdminEscalationMessages(escalationId, signal),
    [escalationId],
  );
  const { data, error, isInitialLoading, retry } = useEscalationRequest(request);

  return (
    <AsyncContent
      error={data ? null : error}
      isLoading={isInitialLoading}
      loadingMessage="공유된 내용을 불러오고 있어요."
      onRetry={retry}
    >
      {data ? (
        <div className="board-risk-tab">
          <section className="board-risk-workflow-panel admin-reason-panel">
            <div className="board-risk-section-header">
              <div>
                <h2 className="board-risk-section-title">교사 공유 사유</h2>
              </div>
            </div>
            <p className="admin-reason-text">{data.reason}</p>
            <p className="admin-attachments">
              공유 자료: {[
                data.maskedMessages.length > 0 && '개인정보가 가려진 메시지',
                data.originalMessages.length > 0 && '원문 메시지',
                data.mediationPackageIncluded && '증빙 패키지',
              ].filter(Boolean).join(', ') || '없음'}
            </p>
          </section>

          {data.maskedMessages.length > 0 ? (
            <SharedMessages label="개인정보가 가려진 메시지" messages={data.maskedMessages} />
          ) : null}
          {data.originalMessages.length > 0 ? (
            <SharedMessages
              label="원문 메시지"
              messages={data.originalMessages}
              notice="원문에는 정서적으로 부담이 될 수 있는 표현이 포함되어 있을 수 있습니다."
            />
          ) : null}
        </div>
      ) : null}
    </AsyncContent>
  );
}

type SharedMessagesProps = {
  label: string;
  messages: ConversationMessage[];
  notice?: string;
};

function SharedMessages({ label, messages, notice }: SharedMessagesProps) {
  return (
    <section className="board-risk-evidence-panel admin-message-panel" aria-label={label}>
      <div className="board-risk-section-header">
        <div>
          <h2 className="board-risk-section-title">{label}</h2>
        </div>
      </div>
      {notice ? <p className="admin-message-notice">{notice}</p> : null}
      {messages.map((message) => (
        <div key={message.messageId}>
          <p className="admin-message-notice">
            {message.senderName} · <time dateTime={message.sentAt}>{formatEscalationTime(message.sentAt)}</time>
          </p>
          <p className="admin-message-text">{message.content}</p>
        </div>
      ))}
    </section>
  );
}

function toRiskFactor(factor: DetectedFactor, index: number): RiskFactor {
  return {
    description: factor.name,
    evidence: factor.evidence,
    id: `${factor.code}-${index}`,
    name: factor.name,
    rationale: factor.reason,
    status: 'detected',
  };
}

function RiskAnalysisPanel({ escalationId }: { escalationId: number }) {
  const request = useCallback(
    (signal: AbortSignal) => getAdminEscalationRisk(escalationId, signal),
    [escalationId],
  );
  const { data, error, isInitialLoading, retry } = useEscalationRequest(request);
  const items = (data?.detectedFactors ?? []).map(toRiskFactor).map((factor) => ({
    id: factor.id,
    title: <RiskFactorTitle factor={factor} />,
    content: <RiskFactorDetail factor={factor} />,
  }));

  return (
    <AsyncContent
      error={data ? null : error}
      isLoading={isInitialLoading}
      loadingMessage="위험 분석 결과를 불러오고 있어요."
      onRetry={retry}
    >
      {data ? (
        <div className="board-risk-tab">
          <section className="board-risk-workflow-panel">
            <div className="board-risk-section-header">
              <div>
                <h2 className="board-risk-section-title">위험도</h2>
              </div>
            </div>
            <dl className="board-admin-share-summary">
              <div>
                <dt>시스템 분석</dt>
                <dd>{riskText(data.riskLevel, data.riskScore)}</dd>
              </div>
              {/* reviewLevel falls back to the analysed level, so it only means a review once one exists. */}
              {data.latestReview ? (
                <div>
                  <dt>교사 검토</dt>
                  <dd>{riskText(data.reviewLevel, data.reviewScore)}</dd>
                </div>
              ) : null}
              {data.latestReview ? (
                <div>
                  <dt>최근 검토</dt>
                  <dd>
                    {data.latestReview.reviewedBy} · {formatEscalationTime(data.latestReview.reviewedAt)}
                    {data.latestReview.reason ? ` · ${data.latestReview.reason}` : ''}
                  </dd>
                </div>
              ) : null}
              {data.safetyLock ? (
                <div>
                  <dt>안전 잠금</dt>
                  <dd>유지 중 · 담당 교사 화면에 긴급 단계 정책이 적용됩니다.</dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="board-risk-evidence-panel">
            <div className="board-risk-section-header">
              <div>
                <RiskSectionIcon />
                <h2 className="board-risk-section-title">확인된 위험 요소와 판단 근거</h2>
              </div>
            </div>
            {items.length > 0 ? (
              <Accordion allowMultiple className="board-risk-factor-accordion" items={items} />
            ) : (
              <EmptyState
                className="board-risk-empty board-risk-factor-empty"
                description="이 메시지에서는 별도 위험 요소가 감지되지 않았습니다."
                title="없음"
              />
            )}
          </section>
        </div>
      ) : null}
    </AsyncContent>
  );
}

function riskChangeText(event: HistoryEvent) {
  if (!event.riskLevel) return null;
  const after = riskText(event.riskLevel, event.riskScore);
  return event.previousRiskLevel ? `${riskText(event.previousRiskLevel, event.previousRiskScore)} → ${after}` : after;
}

function HistoryPanel({ escalationId }: { escalationId: number }) {
  const request = useCallback(
    (signal: AbortSignal) => getAdminEscalationHistory(escalationId, signal),
    [escalationId],
  );
  const { data, error, isInitialLoading, retry } = useEscalationRequest(request);

  return (
    <AsyncContent
      error={data ? null : error}
      isLoading={isInitialLoading}
      loadingMessage="처리 기록을 불러오고 있어요."
      onRetry={retry}
    >
      <section className="board-activity-panel" aria-label="처리 기록">
        <div className="board-risk-section-header">
          <div>
            <FileSearchIcon aria-hidden="true" />
            <h2 className="board-risk-section-title">처리 기록</h2>
          </div>
        </div>
        {data && data.events.length > 0 ? (
          <ol className="board-activity-list">
            {[...data.events].reverse().map((event) => {
              const riskChange = riskChangeText(event);
              return (
                <li key={event.eventId}>
                  <time dateTime={event.occurredAt}>{formatEscalationTime(event.occurredAt)}</time>
                  <div>
                    <strong>{historyEventLabel[event.type]}</strong>
                    <span>{event.actorName}</span>
                    {riskChange ? <p>{riskChange}</p> : null}
                    {event.reason ? <p>{event.reason}</p> : null}
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <EmptyState className="board-risk-empty" description="아직 남겨진 처리 기록이 없습니다." title="기록 없음" />
        )}
      </section>
    </AsyncContent>
  );
}
