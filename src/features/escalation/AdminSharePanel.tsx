import { useCallback, useEffect, useState } from 'react';
import { SearchIcon } from '../../shared/components/teacher-shell/icons';
import { AsyncContent } from '../../shared/components';
import { Button, Dropdown, EmptyState, Tabs, TextField } from '../../shared/components/ui';
import type { EscalationStatus, RiskLevel } from '../../shared/types';
import { riskLabel } from '../message/messageRules';
import { listMyEscalations } from './api';
import { AdminShareList } from './components/AdminShareList';
import { apiRiskTone, escalationStatusLabel, riskLevelOrder } from './escalationRules';
import { useEscalationRequest } from './useEscalationRequest';

type StatusTab = 'all' | Extract<EscalationStatus, 'SHARED' | 'UNDER_REVIEW' | 'COMPLETED'>;
type RiskFilter = 'all' | RiskLevel;
type ListFilters = { keyword: string; risk: RiskFilter; status: StatusTab; page: number };

const statusTabs: StatusTab[] = ['all', 'SHARED', 'UNDER_REVIEW', 'COMPLETED'];
const riskFilterOptions = [
  { label: '전체', value: 'all' },
  ...[...riskLevelOrder].reverse().map((level) => ({ label: riskLabel[apiRiskTone[level]], value: level })),
];
const emptyCopy: Record<StatusTab, { description: string; title: string }> = {
  all: {
    title: '관리자에게 공유한 메시지가 없습니다',
    description: '메시지 상세의 위험 요소 탭에서 긴급 메시지를 관리자에게 공유할 수 있습니다.',
  },
  SHARED: {
    title: '관리자 확인을 기다리는 메시지가 없습니다',
    description: '관리자에게 새로 공유한 메시지가 이곳에 표시됩니다.',
  },
  UNDER_REVIEW: {
    title: '관리자가 검토 중인 메시지가 없습니다',
    description: '관리자가 검토를 시작하면 이곳에서 확인할 수 있습니다.',
  },
  COMPLETED: {
    title: '관리자가 처리 완료한 메시지가 없습니다',
    description: '관리자가 검토를 마친 메시지가 이곳에 모입니다.',
  },
};

export function AdminSharePanel() {
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState<ListFilters>({ keyword: '', risk: 'all', status: 'all', page: 0 });
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const keyword = searchInput.trim();
      setFilters((current) => current.keyword === keyword ? current : { ...current, keyword, page: 0 });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  return (
    <section className="teacher-admin-share-panel" aria-label="관리자 공유 현황">
      <p className="teacher-admin-share-notice">
        관리자에게 공유한 메시지와 처리 상태를 확인할 수 있습니다. 메시지를 선택하면 상세 내용을 확인할 수 있습니다.
      </p>
      <div className="board-toolbar">
        <div className="board-detail-filter-field">
          <span>위험도</span>
          <Dropdown
            ariaLabel="위험도 필터"
            className="board-filter-select"
            menuLabel="위험도"
            onValueChange={(value) => setFilters((current) => ({ ...current, risk: value as RiskFilter, page: 0 }))}
            options={riskFilterOptions}
            value={filters.risk}
          />
        </div>
        <div className="teacher-admin-share-search" role="search" aria-label="공유 내역 검색">
          <TextField
            aria-label="민원 제목 또는 학생명"
            containerClassName="board-search-field ui-search-field"
            leadingIcon={<SearchIcon />}
            maxLength={100}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="민원 제목 또는 학생명"
            type="search"
            value={searchInput}
          />
        </div>
      </div>
      <AdminShareResults
        filters={filters}
        onPageChange={(page) => setFilters((current) => ({ ...current, page }))}
        onStatusChange={(status) => setFilters((current) => ({ ...current, status, page: 0 }))}
      />
    </section>
  );
}

type AdminShareResultsProps = {
  filters: ListFilters;
  onPageChange: (page: number) => void;
  onStatusChange: (status: StatusTab) => void;
};

// Match each response to its query so previous filters cannot appear as the current results.
function AdminShareResults({ filters, onPageChange, onStatusChange }: AdminShareResultsProps) {
  const { keyword, risk, status, page } = filters;
  const queryKey = JSON.stringify(filters);
  const load = useCallback(async (signal: AbortSignal) => {
    const pages = await Promise.all(statusTabs.map((tab) => listMyEscalations({
      keyword: keyword || undefined,
      riskLevel: risk === 'all' ? undefined : risk,
      status: tab === 'all' ? undefined : tab,
      page: tab === status ? page : 0,
    }, signal)));
    return { queryKey, pages };
  }, [keyword, risk, status, page, queryKey]);
  const { data, error, retry } = useEscalationRequest(load);
  const currentData = data?.queryKey === queryKey ? data.pages : null;
  const result = currentData?.[statusTabs.indexOf(status)];
  const lastPage = Math.max(0, (result?.totalPages ?? 1) - 1);
  const isPageOutOfRange = !!result && page > lastPage;

  useEffect(() => {
    if (isPageOutOfRange) onPageChange(lastPage);
  }, [isPageOutOfRange, lastPage, onPageChange]);

  const copy = keyword || risk !== 'all'
    ? { title: '조건에 맞는 공유 메시지가 없습니다', description: '검색어나 위험도, 처리 상태를 변경해 다시 확인해 주세요.' }
    : emptyCopy[status];
  const content = (
    <AsyncContent
      error={error}
      homePath="/teacher"
      isLoading={!error && (!currentData || isPageOutOfRange)}
      loadingMessage="공유 내역을 불러오고 있어요."
      onRetry={retry}
    >
      {result && result.content.length > 0 ? (
        <AdminShareList escalations={result.content} />
      ) : (
        <EmptyState className="board-empty-state" {...copy} />
      )}
      {result && result.totalPages > 1 ? (
        <nav className="teacher-admin-share-pagination" aria-label="공유 내역 페이지">
          <Button disabled={!result.hasPrevious} onClick={() => onPageChange(result.page - 1)} variant="outline">
            이전 페이지
          </Button>
          <span aria-live="polite">{result.page + 1} / {result.totalPages}</span>
          <Button disabled={!result.hasNext} onClick={() => onPageChange(result.page + 1)} variant="outline">
            다음 페이지
          </Button>
        </nav>
      ) : null}
    </AsyncContent>
  );

  return (
    <Tabs
      ariaLabel="관리자 처리 상태"
      className="board-tabs teacher-admin-share-tabs"
      items={statusTabs.map((tab, index) => ({
        value: tab,
        label: (
          <span className="board-tab-label">
            <span>{tab === 'all' ? '전체' : escalationStatusLabel[tab]}</span>
            <span>{currentData?.[index].totalElements ?? '-'}</span>
          </span>
        ),
        content,
      }))}
      onValueChange={(value) => onStatusChange(value as StatusTab)}
      value={status}
    />
  );
}
