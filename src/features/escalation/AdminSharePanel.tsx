import { AsyncContent } from '../../shared/components';
import { EmptyState } from '../../shared/components/ui';
import { listMyEscalations } from './api';
import { AdminShareList } from './components/AdminShareList';
import type { MockTeacherEscalation } from './escalationTypes';
import { useEscalationRequest } from './useEscalationRequest';

// The backend has no "my shared complaints" endpoint, so only the mock adapter provides one.
const loadMyEscalations = (signal: AbortSignal): Promise<MockTeacherEscalation[] | null> =>
  listMyEscalations ? listMyEscalations(signal) : Promise.resolve(null);

export function AdminSharePanel() {
  const { data, error, isInitialLoading, retry } = useEscalationRequest(loadMyEscalations);

  return (
    <section className="page-section" aria-label="관리자 공유 현황">
      <AsyncContent
        error={data ? null : error}
        homePath="/teacher"
        isLoading={isInitialLoading}
        loadingMessage="공유 내역을 불러오고 있어요."
        onRetry={retry}
      >
        {data === null ? (
          <EmptyState
            description="공유 내역 조회 API가 아직 제공되지 않습니다. 메시지 상세의 위험 요소 탭에서 공유 상태를 확인해 주세요."
            title="공유 내역을 불러올 수 없습니다"
          />
        ) : data.length > 0 ? (
          <AdminShareList escalations={data} />
        ) : (
          <EmptyState
            description="메시지 상세의 위험 요소 탭에서 긴급 메시지를 관리자에게 공유할 수 있습니다."
            title="관리자에게 공유한 메시지가 없습니다"
          />
        )}
      </AsyncContent>
    </section>
  );
}
