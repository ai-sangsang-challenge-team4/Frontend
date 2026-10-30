import { useCallback, useEffect, useId, useState } from 'react';
import { getApiErrorMessage, isApiError } from '../../../shared/api';
import { StatusChip } from '../../../shared/components/ui';
import type { EmergencyReviewDecision, EscalationStatus, RiskLevel } from '../../../shared/types';
import {
  completeEscalation,
  getAdminEmergencyReview,
  startEscalationReview,
  updateEmergencyReview,
} from '../../escalation/api';
import {
  ADMIN_MESSAGE_MAX_LENGTH,
  apiRiskTone,
  toDisplayRiskScore,
  canCompleteEscalation,
  canDecideEmergencyReview,
  canReleaseSafetyLock,
  canStartEscalationReview,
  escalationStatusChip,
  escalationStatusLabel,
  formatEscalationTime,
  riskReviewStatusChip,
  riskReviewStatusLabel,
} from '../../escalation/escalationRules';
import type {
  AdminEscalationSummaryResponse,
  EmergencyReviewResponse,
  EscalationStateResponse,
} from '../../escalation/escalationTypes';
import { useEscalationRequest } from '../../escalation/useEscalationRequest';
import { BoardConfirmDialog } from '../../message/components/BoardConfirmDialog';
import { riskLabel } from '../../message/messageRules';

const steps: EscalationStatus[] = ['SHARED', 'UNDER_REVIEW', 'COMPLETED'];

type PanelAction = 'review' | 'complete' | 'release-lock' | EmergencyReviewDecision;

function riskText(level: RiskLevel, score: number) {
  return `${riskLabel[apiRiskTone[level]]}(${toDisplayRiskScore(score)}점)`;
}

const decisionCopy: Record<EmergencyReviewDecision, string> = {
  APPLIED: '승인',
  REJECTED: '거부',
};

type AdminProcessPanelProps = {
  summary: AdminEscalationSummaryResponse;
  // Called after a 409 so the summary can refetch the latest status.
  onConflict: () => void;
};

export function AdminProcessPanel({ summary, onConflict }: AdminProcessPanelProps) {
  const memoId = useId();
  const decisionId = useId();
  const [memo, setMemo] = useState('');
  const [decisionMessage, setDecisionMessage] = useState('');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isReleaseConfirmOpen, setIsReleaseConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PanelAction | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // The latest action response wins until the summary refetch catches up.
  const [actionState, setActionState] = useState<EscalationStateResponse | null>(null);
  const [reviewResult, setReviewResult] = useState<EmergencyReviewResponse | null>(null);
  // Every action refetches the summary (ESCALATIONS_CHANGED_EVENT); once it lands it is the source of truth.
  useEffect(() => {
    setActionState(null);
    setReviewResult(null);
  }, [summary]);
  const escalationStatus = actionState?.escalationStatus ?? summary.escalationStatus;
  const emergencyReviewRequestId = actionState?.emergencyReviewRequestId ?? summary.emergencyReviewRequestId;
  const riskReviewStatus = reviewResult?.status ?? actionState?.riskReviewStatus ?? summary.riskReviewStatus;
  const safetyLock = reviewResult?.safetyLock ?? actionState?.safetyLock ?? summary.safetyLock;
  const loadReview = useCallback(
    (signal: AbortSignal) => emergencyReviewRequestId === null
      ? Promise.resolve(null)
      : getAdminEmergencyReview(emergencyReviewRequestId, signal),
    [emergencyReviewRequestId],
  );
  const { data: emergencyReview, error: emergencyReviewError } = useEscalationRequest(loadReview);
  const currentStep = steps.indexOf(escalationStatus);
  const isSubmitting = pendingAction !== null;
  // The backend rejects a blank message on every action (@NotBlank), despite minLength 0 in the spec.
  const trimmedMemo = memo.trim();
  const trimmedDecision = decisionMessage.trim();

  const run = async (action: PanelAction, call: () => Promise<void>) => {
    if (isSubmitting) return;
    setPendingAction(action);
    setErrorMessage(null);
    try {
      await call();
      setMemo('');
      setDecisionMessage('');
      setIsConfirmOpen(false);
      setIsReleaseConfirmOpen(false);
    } catch (error) {
      setIsConfirmOpen(false);
      setIsReleaseConfirmOpen(false);
      setErrorMessage(getApiErrorMessage(error, '처리 상태를 변경하지 못했습니다. 다시 시도해 주세요.'));
      if (isApiError(error) && error.kind === 'CONFLICT') {
        setActionState(null);
        setReviewResult(null);
        onConflict();
      }
    } finally {
      setPendingAction(null);
    }
  };

  const startReview = () => run('review', async () => {
    setActionState(await startEscalationReview(summary.escalationId, { message: trimmedMemo }));
  });
  const complete = () => run('complete', async () => {
    setActionState(await completeEscalation(summary.escalationId, { message: trimmedMemo }));
  });
  // The request ID comes from the summary; the decision is PATCHed on the emergency review itself.
  const decide = (status: EmergencyReviewDecision) => run(status, async () => {
    if (emergencyReviewRequestId === null) return;
    setReviewResult(await updateEmergencyReview(emergencyReviewRequestId, { message: trimmedDecision, status }));
  });
  const releaseLock = () => run('release-lock', async () => {
    if (emergencyReviewRequestId === null) return;
    setReviewResult(await updateEmergencyReview(emergencyReviewRequestId, { safetyLock: false }));
  });

  const canStart = canStartEscalationReview(escalationStatus);
  const canComplete = canCompleteEscalation(escalationStatus, riskReviewStatus);
  const canDecide = canDecideEmergencyReview(emergencyReviewRequestId, riskReviewStatus);
  const canRelease = canReleaseSafetyLock(emergencyReviewRequestId, riskReviewStatus, safetyLock);

  return (
    <section className="board-risk-workflow-panel admin-process-panel" aria-labelledby="admin-process-title">
      <div className="board-risk-section-header">
        <div>
          <h2 className="board-risk-section-title" id="admin-process-title">처리 상태</h2>
          <StatusChip
            label={escalationStatusLabel[escalationStatus]}
            status={escalationStatusChip[escalationStatus]}
          />
          {riskReviewStatus ? (
            <StatusChip
              label={`위험도 변경 ${riskReviewStatusLabel[riskReviewStatus]}`}
              status={riskReviewStatusChip[riskReviewStatus]}
            />
          ) : null}
          {safetyLock ? <StatusChip label="안전 잠금 유지 중" status="urgent" /> : null}
        </div>
      </div>

      <ol className="admin-process-steps" aria-label="처리 단계">
        {steps.map((step, index) => (
          <li
            aria-current={index === currentStep ? 'step' : undefined}
            className={index < currentStep ? 'is-done' : index === currentStep ? 'is-current' : ''}
            key={step}
          >
            <span aria-hidden="true">{index + 1}</span>
            {escalationStatusLabel[step]}
          </li>
        ))}
      </ol>

      {emergencyReviewRequestId !== null ? (
        <div className="admin-process-result" aria-label="긴급 위험도 재검토 요청">
          {emergencyReview ? (
            <>
              <p>
                <strong>요청 위험도</strong>
                {riskText(emergencyReview.previousRiskLevel, emergencyReview.previousRiskScore)} →{' '}
                {riskText(emergencyReview.requestedRiskLevel, emergencyReview.requestedRiskScore)}
              </p>
              <p><strong>요청 사유</strong>{emergencyReview.reason}</p>
              <p><strong>요청 시각</strong>{formatEscalationTime(emergencyReview.requestedAt)}</p>
            </>
          ) : emergencyReviewError ? (
            <p role="alert">{getApiErrorMessage(emergencyReviewError, '재검토 요청 내용을 불러오지 못했습니다.')}</p>
          ) : null}
          {safetyLock ? (
            <p>
              안전 잠금이 유지되는 동안 담당 교사 화면에는 위험도와 관계없이 긴급 단계 정책(개별 답변 작성 차단)이
              적용됩니다. 승인해도 잠금은 자동으로 해제되지 않습니다.
            </p>
          ) : null}
        </div>
      ) : null}

      {canDecide ? (
        <div className="admin-process-form">
          <label className="board-ai-objection-reason-label" htmlFor={decisionId}>
            위험도 변경 결정 사유 <strong aria-hidden="true">*</strong>
          </label>
          <div className="board-risk-review-textarea-shell admin-process-memo">
            <textarea
              aria-required="true"
              id={decisionId}
              maxLength={ADMIN_MESSAGE_MAX_LENGTH}
              onChange={(event) => setDecisionMessage(event.target.value)}
              placeholder="담당 교사의 위험도 변경 요청을 승인하거나 거부하는 이유를 적어 주세요."
              value={decisionMessage}
            />
            <span>{decisionMessage.length} / {ADMIN_MESSAGE_MAX_LENGTH}</span>
          </div>
          <div className="admin-process-actions">
            {(['REJECTED', 'APPLIED'] as const).map((status) => (
              <button
                className={status === 'APPLIED' ? 'board-primary-button admin-process-button' : 'board-outline-button admin-process-button'}
                disabled={isSubmitting || !trimmedDecision}
                key={status}
                onClick={() => void decide(status)}
                type="button"
              >
                {pendingAction === status ? '처리 중…' : `위험도 변경 ${decisionCopy[status]}`}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {canRelease ? (
        <div className="admin-process-actions">
          <button
            className="board-outline-button admin-process-button"
            disabled={isSubmitting}
            onClick={() => setIsReleaseConfirmOpen(true)}
            type="button"
          >
            {pendingAction === 'release-lock' ? '처리 중…' : '안전 잠금 해제'}
          </button>
        </div>
      ) : null}

      {canStart || canComplete ? (
        <div className="admin-process-form">
          <label className="board-ai-objection-reason-label" htmlFor={memoId}>
            처리 메모 <strong aria-hidden="true">*</strong>
          </label>
          <div className="board-risk-review-textarea-shell admin-process-memo">
            <textarea
              aria-required="true"
              id={memoId}
              maxLength={ADMIN_MESSAGE_MAX_LENGTH}
              onChange={(event) => setMemo(event.target.value)}
              placeholder={canStart
                ? '검토를 시작하며 확인할 내용이나 계획을 적어 주세요.'
                : '확인한 규정, 담당 교사와 협의한 대응 방향 등 처리 결과를 적어 주세요.'}
              value={memo}
            />
            <span>{memo.length} / {ADMIN_MESSAGE_MAX_LENGTH}</span>
          </div>
          <div className="admin-process-actions">
            <button
              className="board-primary-button admin-process-button"
              disabled={isSubmitting || !trimmedMemo}
              onClick={() => (canStart ? void startReview() : setIsConfirmOpen(true))}
              type="button"
            >
              {pendingAction === 'review' ? '변경 중…' : canStart ? '검토 시작' : '처리 완료'}
            </button>
          </div>
        </div>
      ) : null}

      {errorMessage ? <p className="board-admin-share-error" role="alert">{errorMessage}</p> : null}

      {escalationStatus === 'COMPLETED' ? (
        <div className="admin-process-result">
          <p>검토가 완료된 메시지입니다. 담당 교사에게 처리 완료 상태가 표시됩니다.</p>
        </div>
      ) : null}

      <BoardConfirmDialog
        actions={[
          { label: '취소', onClick: () => setIsConfirmOpen(false) },
          {
            disabled: isSubmitting || !trimmedMemo,
            label: pendingAction === 'complete' ? '변경 중…' : '처리 완료',
            onClick: () => void complete(),
            tone: 'primary',
          },
        ]}
        descriptionId="admin-complete-description"
        onClose={() => setIsConfirmOpen(false)}
        open={isConfirmOpen}
        title="처리 완료로 변경할까요?"
        titleId="admin-complete-title"
      >
        <p className="board-confirm-modal-copy" id="admin-complete-description">
          완료 후에는 담당 교사에게 처리 완료 상태가 표시됩니다.
        </p>
      </BoardConfirmDialog>

      <BoardConfirmDialog
        actions={[
          { label: '취소', onClick: () => setIsReleaseConfirmOpen(false) },
          {
            disabled: isSubmitting,
            label: pendingAction === 'release-lock' ? '처리 중…' : '잠금 해제',
            onClick: () => void releaseLock(),
            tone: 'primary',
          },
        ]}
        descriptionId="admin-release-lock-description"
        onClose={() => setIsReleaseConfirmOpen(false)}
        open={isReleaseConfirmOpen}
        title="안전 잠금을 해제할까요?"
        titleId="admin-release-lock-title"
      >
        <p className="board-confirm-modal-copy" id="admin-release-lock-description">
          해제하면 담당 교사 화면의 긴급 단계 정책이 현재 위험도 기준으로 바뀝니다.
        </p>
      </BoardConfirmDialog>
    </section>
  );
}
