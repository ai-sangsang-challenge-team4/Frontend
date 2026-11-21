import { useCallback } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../features/auth';
import { parentMessageApiMode } from '../../features/parent-message/api/parentComplaintApi';
import { ParentMessageComposer } from '../../features/parent-message/ParentMessageComposer';
import { ParentMessageHeader } from '../../features/parent-message/ParentMessageHeader';
import { prepareServerFollowUp } from '../../features/parent-message/serverHistory';
import { useApiRequest } from '../../shared/api';
import { ApiErrorFallback, LoadingState } from '../../shared/components/feedback';

function ServerFollowUpWritePage({ userId, threadId, search }: { userId: number; threadId: string; search: string }) {
  const navigate = useNavigate();
  const request = useCallback((signal: AbortSignal) => prepareServerFollowUp(userId, threadId, signal), [userId, threadId]);
  const { data, error, isLoading, retry } = useApiRequest(request);
  const resolvedThreadId = data?.threadId ?? threadId;
  const detailPath = `/parent/messages/${encodeURIComponent(resolvedThreadId)}`;

  if (isLoading || error) return <>
    <ParentMessageHeader title="추가 문의하기" backLabel="문의 상세로 돌아가기" onBack={() => navigate(detailPath)} />
    <main className="layout-main">
      {error ? <ApiErrorFallback error={error} homePath="/parent/messages" onRetry={retry} variant="section" />
        : <LoadingState message="추가 문의 가능 여부를 확인하고 있어요." />}
    </main>
  </>;
  if (data && !data.canWrite) return <Navigate replace to={detailPath} />;

  const params = new URLSearchParams(search);
  return <ParentMessageComposer key={search} userId={userId} threadId={resolvedThreadId}
    draftId={params.get('draft') ?? undefined} fresh={params.has('fresh')} />;
}

export function MessageWritePage() {
  const { user } = useAuth();
  const { messageId } = useParams();
  const { search } = useLocation();
  if (!user) return null;

  const pageKey = `${user.userId}-${messageId ?? 'new'}`;
  if (messageId && parentMessageApiMode === 'http') {
    return <ServerFollowUpWritePage key={pageKey} userId={user.userId} threadId={messageId} search={search} />;
  }

  const params = new URLSearchParams(search);
  return <ParentMessageComposer key={`${pageKey}-${search}`}
    userId={user.userId} threadId={messageId} draftId={params.get('draft') ?? undefined} fresh={params.has('fresh')} />;
}
