import { useId, useState } from 'react';
import { getApiErrorMessage, isApiError } from '../../../shared/api';
import { StatusChip } from '../../../shared/components/ui';
import type { EscalationStatus, RiskChangeDecision } from '../../../shared/types';
import { completeEscalation, decideRiskChange, startEscalationReview } from '../../escalation/api';
import {
  ADMIN_MESSAGE_MAX_LENGTH,
  canCompleteEscalation,
  canDecideRiskChange,
  canStartEscalationReview,
  escalationStatusChip,
  escalationStatusLabel,
  riskReviewStatusChip,
  riskReviewStatusLabel,
} from '../../escalation/escalationRules';
import type { AdminEscalationSummaryResponse, EscalationStateResponse } from '../../escalation/escalationTypes';
import { BoardConfirmDialog } from '../../message/components/BoardConfirmDialog';

const steps: EscalationStatus[] = ['SHARED', 'UNDER_REVIEW', 'COMPLETED'];

type PanelAction = 'review' | 'complete' | RiskChangeDecision;

const decisionCopy: Record<RiskChangeDecision, string> = {
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
  const [pendingAction, setPendingAction] = useState<PanelAction | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // The latest action response wins until the summary refetch catches up.
  const [actionState, setActionState] = useState<EscalationStateResponse | null>(null);
  const escalationStatus = actionState?.escalationStatus ?? summary.escalationStatus;
  // TODO(backend): AdminEscalationSummaryResponse has no riskReviewStatus, so a pending risk change
  // is only known after an action response. The approve/reject buttons stay hidden until then.
  const riskReviewStatus = actionState?.riskReviewStatus ?? null;
  const currentStep = steps.indexOf(escalationStatus);
  const isSubmitting = pendingAction !== null;
  const trimmedDecision = decisionMessage.trim();

  const run = async (action: PanelAction, call: () => Promise<EscalationStateResponse>) => {
    if (isSubmitting) return;
    setPendingAction(action);
    setErrorMessage(null);
    try {
      setActionState(await call());
      setMemo('');
      setDecisionMessage('');
      setIsConfirmOpen(false);
    } catch (error) {
      setIsConfirmOpen(false);
      setErrorMessage(getApiErrorMessage(error, '처리 상태를 변경하지 못했습니다. 다시 시도해 주세요.'));
      if (isApiError(error) && error.kind === 'CONFLICT') {
        setActionState(null);
        onConflict();
      }
    } finally {
      setPendingAction(null);
    }
  };

  const startReview = () =>
    run('review', () => startEscalationReview(summary.escalationId, { message: memo.trim() }));
  const complete = () =>
    run('complete', () => completeEscalation(summary.escalationId, { message: memo.trim() }));
  const decide = (status: RiskChangeDecision) =>
    run(status, () => decideRiskChange(summary.escalationId, { message: trimmedDecision, status }));

  const canStart = canStartEscalationReview(escalationStatus);
  const canComplete = canCompleteEscalation(escalationStatus, riskReviewStatus);
  const canDecide = canDecideRiskChange(riskReviewStatus);

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

      {canStart || canComplete ? (
        <div className="admin-process-form">
          <label className="board-ai-objection-reason-label" htmlFor={memoId}>처리 메모</label>
          <div className="board-risk-review-textarea-shell admin-process-memo">
            <textarea
              id={memoId}
              maxLength={ADMIN_MESSAGE_MAX_LENGTH}
              onChange={(event) => setMemo(event.target.value)}
              placeholder={canStart
                ? '검토 시작 시 남길 메모가 있다면 적어 주세요. (선택)'
                : '확인한 규정, 담당 교사와 협의한 대응 방향 등 처리 결과를 적어 주세요. (선택)'}
              value={memo}
            />
            <span>{memo.length} / {ADMIN_MESSAGE_MAX_LENGTH}</span>
          </div>
          <div className="admin-process-actions">
            <button
              className="board-primary-button admin-process-button"
              disabled={isSubmitting}
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
            disabled: isSubmitting,
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
    </section>
  );
}
