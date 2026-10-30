import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getApiErrorMessage } from '../../shared/api';
import { AsyncContent } from '../../shared/components';
import { Button, ButtonLink, EmptyState, StatusChip } from '../../shared/components/ui';
import type { EmergencyReviewDecision } from '../../shared/types';
import { getAdminEmergencyReview, listAdminEmergencyReviews, updateEmergencyReview } from '../escalation/api';
import { ADMIN_MESSAGE_MAX_LENGTH, canReleaseSafetyLock, formatEscalationTime, riskReviewStatusChip, riskReviewStatusLabel, toDisplayRiskScore } from '../escalation/escalationRules';
import type { EmergencyReviewResponse } from '../escalation/escalationTypes';
import { useEscalationRequest } from '../escalation/useEscalationRequest';
import { BoardConfirmDialog } from '../message/components/BoardConfirmDialog';

const loadReviews = (signal: AbortSignal) => listAdminEmergencyReviews(signal);

export function AdminEmergencyReviewList() {
  const { data, error, isInitialLoading, retry } = useEscalationRequest(loadReviews);
  const [pendingOnly, setPendingOnly] = useState(false);
  const reviews = (data ?? []).filter((item) => !pendingOnly || item.status === 'PENDING_ADMIN_APPROVAL');
  return <main className="board-list-page">
    <h1 className="board-page-title">긴급 재검토 요청</h1>
    <section className="board-list-panel admin-list-panel" aria-label="긴급 재검토 목록">
      <p className="admin-list-notice">나에게 지정된 재검토 요청입니다. 관리자 공유 여부와 관계없이 확인하고 처리할 수 있습니다.</p>
      <label className="board-toolbar"><input checked={pendingOnly} onChange={(event) => setPendingOnly(event.target.checked)} type="checkbox" /> 승인 대기만 보기</label>
      <AsyncContent error={error} homePath="/admin/messages" isLoading={isInitialLoading} loadingMessage="재검토 요청을 불러오고 있어요." onRetry={retry}>
        {reviews.length === 0 ? <EmptyState title="재검토 요청이 없습니다" description={pendingOnly ? '현재 승인을 기다리는 요청이 없습니다.' : '나에게 지정된 요청이 도착하면 여기에 표시됩니다.'} /> : <ul className="admin-emergency-list">
          {reviews.map((review) => <li key={review.requestId}>
            <Link className="admin-emergency-link" to={`/admin/emergency-reviews/${review.requestId}`}>
              <strong>민원 #{review.complaintId} · 재검토 #{review.requestId}</strong>
              <StatusChip label={riskReviewStatusLabel[review.status]} status={riskReviewStatusChip[review.status]} />
              <span>{toDisplayRiskScore(review.previousRiskScore)}점 → {toDisplayRiskScore(review.requestedRiskScore)}점</span>
              <span className="admin-emergency-reason">{review.reason}</span>
              <time>{formatEscalationTime(review.requestedAt)}</time>
            </Link>
          </li>)}
        </ul>}
      </AsyncContent>
    </section>
  </main>;
}

export function AdminEmergencyReviewDetail() {
  const { requestId } = useParams();
  const id = Number(requestId);
  if (!Number.isSafeInteger(id) || id <= 0) return <main className="board-list-page"><p role="alert">올바르지 않은 재검토 요청입니다.</p><ButtonLink to="/admin/emergency-reviews">목록으로</ButtonLink></main>;
  return <EmergencyReviewDetail key={id} requestId={id} />;
}

function EmergencyReviewDetail({ requestId }: { requestId: number }) {
  const loadReview = useCallback((signal: AbortSignal) => getAdminEmergencyReview(requestId, signal), [requestId]);
  const { data, error, isLoading, isInitialLoading, retry } = useEscalationRequest(loadReview);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmRelease, setConfirmRelease] = useState(false);

  const update = async (request: { status?: EmergencyReviewDecision; safetyLock?: boolean }) => {
    if (saving || isLoading || error) return;
    setSaving(true);
    setActionError(null);
    setNotice(null);
    try {
      await updateEmergencyReview(requestId, { ...request, ...(request.status ? { message: message.trim() } : {}) });
      setMessage('');
      setNotice(request.safetyLock === false ? '안전 잠금을 해제했습니다.' : '재검토 결정을 저장했습니다.');
      setConfirmRelease(false);
      retry();
    } catch (cause) {
      setActionError(getApiErrorMessage(cause, '재검토 요청을 처리하지 못했습니다.'));
      retry();
    } finally { setSaving(false); }
  };

  return <main className="board-list-page admin-detail">
    <ButtonLink to="/admin/emergency-reviews" variant="ghost">재검토 목록으로</ButtonLink>
    <h1 className="board-page-title">긴급 재검토 #{requestId}</h1>
    <AsyncContent error={error} homePath="/admin/emergency-reviews" isLoading={isInitialLoading} loadingMessage="재검토 요청을 불러오고 있어요." onRetry={retry}>
      {data ? <section className="board-risk-workflow-panel admin-process-panel" aria-label="긴급 재검토 처리">
        <ReviewInformation review={data} />
        {data.status === 'PENDING_ADMIN_APPROVAL' ? <form className="admin-process-form" onSubmit={(event) => event.preventDefault()}>
          <label htmlFor="emergency-decision">위험도 변경 결정 사유</label>
          <div className="board-risk-review-textarea-shell admin-process-memo"><textarea id="emergency-decision" disabled={saving} value={message} onChange={(event) => setMessage(event.target.value)} maxLength={ADMIN_MESSAGE_MAX_LENGTH} required /></div>
          <div className="admin-process-actions">
            <Button disabled={saving || isLoading || !message.trim()} onClick={() => void update({ status: 'REJECTED' })} variant="outline">위험도 변경 거부</Button>
            <Button disabled={saving || isLoading || !message.trim()} onClick={() => void update({ status: 'APPLIED' })}>위험도 변경 승인</Button>
          </div>
        </form> : null}
        {canReleaseSafetyLock(data.requestId, data.status, data.safetyLock) ? <Button disabled={saving || isLoading} onClick={() => setConfirmRelease(true)} variant="outline">안전 잠금 해제</Button> : null}
        {actionError ? <p role="alert">{actionError}</p> : null}
        {notice ? <p role="status">{notice}</p> : null}
      </section> : null}
    </AsyncContent>
    <BoardConfirmDialog open={confirmRelease} onClose={() => setConfirmRelease(false)} title="안전 잠금을 해제할까요?" titleId="emergency-release-title" descriptionId="emergency-release-description" actions={[
      { label: '취소', onClick: () => setConfirmRelease(false) },
      { label: '잠금 해제', disabled: saving || isLoading, onClick: () => void update({ safetyLock: false }), tone: 'primary' },
    ]}><p id="emergency-release-description">해제하면 담당 교사 화면의 긴급 단계 정책이 현재 위험도 기준으로 바뀝니다.</p></BoardConfirmDialog>
  </main>;
}

export function ReviewInformation({ review }: { review: EmergencyReviewResponse }) {
  return <div className="admin-process-result">
    <StatusChip label={riskReviewStatusLabel[review.status]} status={riskReviewStatusChip[review.status]} />
    <p><strong>민원</strong> #{review.complaintId}</p>
    <p><strong>요청 위험도</strong> {toDisplayRiskScore(review.previousRiskScore)}점 → {toDisplayRiskScore(review.requestedRiskScore)}점</p>
    <p><strong>요청 사유</strong> {review.reason}</p>
    <p><strong>지정 검토자</strong> {review.reviewerName}</p>
    <p><strong>요청 시각</strong> {formatEscalationTime(review.requestedAt)}</p>
    {review.decidedAt ? <p><strong>결정 시각</strong> {formatEscalationTime(review.decidedAt)}</p> : null}
    <p><strong>안전 잠금</strong> {review.safetyLock ? '유지 중' : '해제됨'}</p>
    {review.safetyLock ? <p>승인해도 안전 잠금은 자동 해제되지 않습니다.</p> : null}
  </div>;
}
