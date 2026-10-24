import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AsyncContent } from '../../shared/components';
import { Accordion, EmptyState, StatusChip } from '../../shared/components/ui';
import { getAdminComplaint } from '../escalation/api';
import {
  apiRiskTone,
  escalationStatusChip,
  escalationStatusLabel,
  formatEscalationTime,
} from '../escalation/escalationRules';
import type { AdminComplaintDetail, SharedRiskFactor } from '../escalation/escalationTypes';
import { useEscalationRequest } from '../escalation/useEscalationRequest';
import { BreadcrumbSeparator, FileSearchIcon, RiskSectionIcon } from '../message/components/MessageIcons';
import { ProfileAvatar } from '../message/components/ProfileAvatar';
import { RiskBadge } from '../message/components/RiskBadge';
import { RiskFactorDetail, RiskFactorTitle } from '../message/components/RiskFactorDisplay';
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
  complaintId: string;
};

export function AdminSharedMessageDetail({ complaintId }: AdminSharedMessageDetailProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<DetailTab>('shared');
  const request = useCallback((signal: AbortSignal) => getAdminComplaint(complaintId, signal), [complaintId]);
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
              <AdminContextCard detail={data} />
              <AdminProcessPanel detail={data} onConflict={retry} />

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

              {activeTab === 'shared' ? <SharedContentPanel detail={data} /> : null}
              {activeTab === 'risk' ? <RiskAnalysisPanel detail={data} /> : null}
              {activeTab === 'history' ? <HistoryPanel detail={data} /> : null}
            </>
          ) : null}
        </AsyncContent>
      </section>
    </main>
  );
}

function AdminContextCard({ detail }: { detail: AdminComplaintDetail }) {
  return (
    <div className="board-parent-card">
      <div className="board-card-profile">
        <ProfileAvatar />
        <span>
          <strong>{detail.teacherName}</strong>
          <small>{detail.className}</small>
        </span>
      </div>
      <div className="board-card-topic">
        <strong>{detail.title}</strong>
        <span>{detail.parentName} · {detail.studentName} 학생</span>
      </div>
      <div className="board-card-meta-group">
        <div className="board-card-meta">
          <span>위험도</span>
          <RiskBadge level={apiRiskTone[detail.riskLevel]} />
        </div>
        <div className="board-card-meta">
          <span>공유 시각</span>
          <time dateTime={detail.sharedAt}>{formatEscalationTime(detail.sharedAt)}</time>
        </div>
      </div>
    </div>
  );
}

function SharedContentPanel({ detail }: { detail: AdminComplaintDetail }) {
  const attachments = [
    detail.shareMaskedContent && '개인정보가 가려진 메시지',
    detail.shareOriginalContent && '원문 메시지',
    detail.evidencePackageAttached && '증빙 패키지',
  ].filter(Boolean);

  return (
    <div className="board-risk-tab">
      <section className="board-risk-workflow-panel admin-reason-panel">
        <div className="board-risk-section-header">
          <div>
            <h2 className="board-risk-section-title">교사 공유 사유</h2>
          </div>
        </div>
        <p className="admin-reason-text">{detail.reason}</p>
        <p className="admin-attachments">공유 자료: {attachments.join(', ')}</p>
      </section>

      {detail.maskedContent ? (
        <SharedMessage label="개인정보가 가려진 메시지" text={detail.maskedContent} />
      ) : null}
      {detail.originalContent ? (
        <SharedMessage
          label="원문 메시지"
          notice="원문에는 정서적으로 부담이 될 수 있는 표현이 포함되어 있을 수 있습니다."
          text={detail.originalContent}
        />
      ) : null}
    </div>
  );
}

function SharedMessage({ label, notice, text }: { label: string; notice?: string; text: string }) {
  return (
    <section className="board-risk-evidence-panel admin-message-panel" aria-label={label}>
      <div className="board-risk-section-header">
        <div>
          <h2 className="board-risk-section-title">{label}</h2>
        </div>
      </div>
      {notice ? <p className="admin-message-notice">{notice}</p> : null}
      <p className="admin-message-text">{text}</p>
    </section>
  );
}

function toRiskFactor(factor: SharedRiskFactor): RiskFactor {
  return {
    description: factor.description,
    evidence: factor.evidenceSpan ?? '',
    id: factor.id,
    name: factor.name,
    rationale: factor.rationale,
    status: factor.status,
  };
}

function RiskAnalysisPanel({ detail }: { detail: AdminComplaintDetail }) {
  const items = detail.riskFactors.map(toRiskFactor).map((factor) => ({
    id: factor.id,
    title: <RiskFactorTitle factor={factor} />,
    content: <RiskFactorDetail factor={factor} />,
  }));

  return (
    <div className="board-risk-tab">
      {detail.bufferedSummary ? (
        <section className="board-risk-workflow-panel">
          <div className="board-risk-section-header">
            <div>
              <h2 className="board-risk-section-title">완충 요약</h2>
            </div>
          </div>
          <p>{detail.bufferedSummary}</p>
        </section>
      ) : null}

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

      {detail.recommendedActions.length > 0 ? (
        <section className="board-risk-workflow-panel">
          <div className="board-risk-section-header">
            <div>
              <h2 className="board-risk-section-title">권장 처리</h2>
            </div>
          </div>
          <ol className="admin-recommended-actions">
            {detail.recommendedActions.map((action) => <li key={action}>{action}</li>)}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

function HistoryPanel({ detail }: { detail: AdminComplaintDetail }) {
  return (
    <section className="board-activity-panel" aria-label="처리 기록">
      <div className="board-risk-section-header">
        <div>
          <FileSearchIcon aria-hidden="true" />
          <h2 className="board-risk-section-title">처리 기록</h2>
        </div>
      </div>
      <ol className="board-activity-list">
        {[...detail.history].reverse().map((entry) => (
          <li key={`${entry.changedAt}-${entry.newStatus}`}>
            <time dateTime={entry.changedAt}>{formatEscalationTime(entry.changedAt)}</time>
            <div>
              <strong>
                {entry.previousStatus === 'NOT_SHARED' ? '관리자 공유' : `${escalationStatusLabel[entry.newStatus]}로 변경`}
              </strong>
              <span>{entry.changedBy}</span>
              {entry.memo ? <p>{entry.memo}</p> : null}
            </div>
            <StatusChip
              className="admin-history-chip"
              label={escalationStatusLabel[entry.newStatus]}
              size="sm"
              status={escalationStatusChip[entry.newStatus]}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}
