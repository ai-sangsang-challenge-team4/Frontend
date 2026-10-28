import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AsyncContent } from '../../shared/components';
import { Dropdown, EmptyState, StatusChip, Tabs } from '../../shared/components/ui';
import type { EscalationStatus, RiskLevel } from '../../shared/types';
import { listAdminEscalations } from '../escalation/api';
import {
  apiRiskTone,
  escalationStatusChip,
  escalationStatusLabel,
  formatEscalationTime,
  riskLevelOrder,
} from '../escalation/escalationRules';
import type { AdminEscalationSummaryResponse } from '../escalation/escalationTypes';
import { useEscalationRequest } from '../escalation/useEscalationRequest';
import { ProfileAvatar } from '../message/components/ProfileAvatar';
import { RiskBadge } from '../message/components/RiskBadge';
import { riskLabel } from '../message/messageRules';

type StatusTab = 'all' | Extract<EscalationStatus, 'SHARED' | 'UNDER_REVIEW' | 'COMPLETED'>;
type RiskFilter = 'all' | RiskLevel;

const statusTabs: StatusTab[] = ['all', 'SHARED', 'UNDER_REVIEW', 'COMPLETED'];

const riskFilterOptions: { label: string; value: RiskFilter }[] = [
  { label: '전체', value: 'all' },
  ...[...riskLevelOrder].reverse().map((level) => ({ label: riskLabel[apiRiskTone[level]], value: level })),
];

const emptyCopy: Record<StatusTab, { description: string; title: string }> = {
  all: { title: '공유받은 메시지가 없습니다', description: '교사가 공동 검토가 필요하다고 판단해 공유한 메시지만 이곳에 표시됩니다.' },
  SHARED: { title: '확인을 기다리는 메시지가 없습니다', description: '새로 공유된 메시지가 도착하면 이곳에 표시됩니다.' },
  UNDER_REVIEW: { title: '검토 중인 메시지가 없습니다', description: '확인 대기 메시지에서 검토를 시작하면 이곳으로 이동합니다.' },
  COMPLETED: { title: '처리 완료한 메시지가 없습니다', description: '검토를 마친 메시지가 이곳에 모입니다.' },
};

// The list is small enough to load once; tabs and the risk filter work client-side.
const loadSharedComplaints = (signal: AbortSignal) => listAdminEscalations({}, signal);

export function AdminSharedMessageList() {
  const [activeTab, setActiveTab] = useState<StatusTab>('all');
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');
  const { data, error, isInitialLoading, retry } = useEscalationRequest(loadSharedComplaints);

  const riskFiltered = useMemo(
    () => (data ?? []).filter((item) => riskFilter === 'all' || item.currentRiskLevel === riskFilter),
    [data, riskFilter],
  );

  const tabItems = statusTabs.map((tab) => {
    const items = tab === 'all' ? riskFiltered : riskFiltered.filter((item) => item.escalationStatus === tab);
    return {
      value: tab,
      label: <TabLabel count={items.length} label={tab === 'all' ? '전체' : escalationStatusLabel[tab]} />,
      content: <SharedComplaintList emptyCopy={emptyCopy[tab]} items={items} />,
    };
  });

  return (
    <main className="board-list-page">
      <h1 className="board-page-title" id="admin-page-title">공유받은 메시지</h1>

      <section className="board-list-panel admin-list-panel" aria-labelledby="admin-page-title">
        <p className="admin-list-notice">
          교사가 직접 공유한 메시지만 열람할 수 있습니다. 공유되지 않은 메시지는 관리자에게 표시되지 않습니다.
        </p>
        <div className="board-toolbar">
          <div className="board-detail-filter-field">
            <span>위험도</span>
            <Dropdown
              ariaLabel="위험도 필터"
              className="board-filter-select"
              menuLabel="위험도"
              onValueChange={(value) => setRiskFilter(value as RiskFilter)}
              options={riskFilterOptions}
              value={riskFilter}
            />
          </div>
        </div>
        <AsyncContent
          error={data ? null : error}
          homePath="/admin/messages"
          isLoading={isInitialLoading}
          loadingMessage="공유받은 메시지를 불러오고 있어요."
          onRetry={retry}
        >
          <Tabs
            ariaLabel="처리 상태"
            className="board-tabs admin-status-tabs"
            items={tabItems}
            onValueChange={(value) => setActiveTab(value as StatusTab)}
            value={activeTab}
          />
        </AsyncContent>
      </section>
    </main>
  );
}

function TabLabel({ count, label }: { count: number; label: string }) {
  return (
    <span className="board-tab-label">
      <span>{label}</span>
      <span>{count}</span>
    </span>
  );
}

type SharedComplaintListProps = {
  emptyCopy: { description: string; title: string };
  items: AdminEscalationSummaryResponse[];
};

function SharedComplaintList({ emptyCopy: copy, items }: SharedComplaintListProps) {
  if (items.length === 0) {
    return <EmptyState className="board-empty-state" description={copy.description} title={copy.title} />;
  }

  return (
    <section className="board-thread-list" aria-label="공유받은 메시지 목록">
      {items.map((item) => (
        <article className="board-thread-row admin-thread-row" key={item.escalationId}>
          <Link
            aria-label={`민원 #${item.complaintId} 공유 메시지 상세 보기`}
            className="board-thread-button admin-thread-button"
            to={`/admin/messages/${item.escalationId}`}
          >
            <div className="board-thread-parent">
              <ProfileAvatar />
              <span className="board-parent-copy">
                <strong>{item.sharedBy}</strong>
                <span>공유 교사</span>
              </span>
            </div>

            <div className="board-thread-copy">
              <span className="board-thread-title-row">
                <strong>민원 #{item.complaintId}</strong>
                <RiskBadge level={apiRiskTone[item.currentRiskLevel]} />
              </span>
              <span className="admin-thread-reason">공유 사유: {item.reason}</span>
            </div>

            <div className="board-thread-status">
              <StatusChip
                className="board-status-chip"
                label={escalationStatusLabel[item.escalationStatus]}
                status={escalationStatusChip[item.escalationStatus]}
              />
            </div>

            <time className="board-thread-time" dateTime={item.sharedAt}>
              {formatEscalationTime(item.sharedAt)}
            </time>
          </Link>
        </article>
      ))}
    </section>
  );
}
