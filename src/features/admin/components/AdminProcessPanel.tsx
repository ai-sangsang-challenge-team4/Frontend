import { useEffect, useId, useState } from 'react';
import { getApiErrorMessage, isApiError } from '../../../shared/api';
import { StatusChip } from '../../../shared/components/ui';
import type { AdminAction, EscalationStatus } from '../../../shared/types';
import { processAdminComplaint } from '../../escalation/api';
import {
  ADMIN_MEMO_MAX_LENGTH,
  escalationStatusChip,
  escalationStatusLabel,
  formatEscalationTime,
  getNextAdminAction,
} from '../../escalation/escalationRules';
import type { AdminComplaintDetail } from '../../escalation/escalationTypes';
import { BoardConfirmDialog } from '../../message/components/BoardConfirmDialog';

const steps: EscalationStatus[] = ['SHARED', 'UNDER_REVIEW', 'COMPLETED'];

const actionCopy: Record<AdminAction, { button: string; memoPlaceholder: string }> = {
  START_REVIEW: {
    button: '검토 시작',
    memoPlaceholder: '검토 시작 시 남길 메모가 있다면 적어 주세요. (선택)',
  },
  REVIEW_COMPLETE: {
    button: '처리 완료',
    memoPlaceholder: '확인한 규정, 담당 교사와 협의한 대응 방향 등 처리 결과를 적어 주세요. (선택)',
  },
};

type AdminProcessPanelProps = {
  detail: AdminComplaintDetail;
  // Called when the status changed elsewhere so the detail can refetch.
  onConflict: () => void;
};

export function AdminProcessPanel({ detail, onConflict }: AdminProcessPanelProps) {
  const memoId = useId();
  const [memo, setMemo] = useState('');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const nextAction = getNextAdminAction(detail.escalationStatus);
  const currentStep = steps.indexOf(detail.escalationStatus);

  // A memo belongs to one step; keep any error so a 409 refetch still shows why.
  useEffect(() => {
    setMemo('');
  }, [detail.escalationStatus]);

  const submit = async (action: AdminAction) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      // The mock fires a change event, so the detail refetches with the new status.
      await processAdminComplaint(detail.complaintId, { action, memo: memo.trim() || undefined });
      setIsConfirmOpen(false);
    } catch (error) {
      setIsConfirmOpen(false);
      setErrorMessage(getApiErrorMessage(error, '처리 상태를 변경하지 못했습니다. 다시 시도해 주세요.'));
      if (isApiError(error) && error.kind === 'CONFLICT') onConflict();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAction = () => {
    if (!nextAction) return;
    if (nextAction === 'REVIEW_COMPLETE') {
      setIsConfirmOpen(true);
      return;
    }
    void submit(nextAction);
  };

  return (
    <section className="board-risk-workflow-panel admin-process-panel" aria-labelledby="admin-process-title">
      <div className="board-risk-section-header">
        <div>
          <h2 className="board-risk-section-title" id="admin-process-title">처리 상태</h2>
          <StatusChip
            label={escalationStatusLabel[detail.escalationStatus]}
            status={escalationStatusChip[detail.escalationStatus]}
          />
        </div>
        {detail.processedAt ? (
          <span className="admin-process-updated">최근 변경 {formatEscalationTime(detail.processedAt)}</span>
        ) : null}
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

      {nextAction ? (
        <div className="admin-process-form">
          <label className="board-ai-objection-reason-label" htmlFor={memoId}>처리 메모</label>
          <div className="board-risk-review-textarea-shell admin-process-memo">
            <textarea
              id={memoId}
              maxLength={ADMIN_MEMO_MAX_LENGTH}
              onChange={(event) => setMemo(event.target.value)}
              placeholder={actionCopy[nextAction].memoPlaceholder}
              value={memo}
            />
            <span>{memo.length} / {ADMIN_MEMO_MAX_LENGTH}</span>
          </div>
          <div className="admin-process-actions">
            {errorMessage ? <p className="board-admin-share-error" role="alert">{errorMessage}</p> : null}
            <button
              className="board-primary-button admin-process-button"
              disabled={isSubmitting}
              onClick={handleAction}
              type="button"
            >
              {isSubmitting && !isConfirmOpen ? '변경 중…' : actionCopy[nextAction].button}
            </button>
          </div>
        </div>
      ) : (
        <div className="admin-process-result">
          <p>검토가 완료된 메시지입니다. 담당 교사에게 처리 완료 상태가 표시됩니다.</p>
          {detail.adminMemo ? <p><strong>처리 메모</strong> {detail.adminMemo}</p> : null}
        </div>
      )}

      <BoardConfirmDialog
        actions={[
          { label: '취소', onClick: () => setIsConfirmOpen(false) },
          {
            disabled: isSubmitting,
            label: isSubmitting ? '변경 중…' : '처리 완료',
            onClick: () => void submit('REVIEW_COMPLETE'),
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
          완료 후에는 담당 교사에게 처리 완료 상태와 메모가 표시됩니다.
        </p>
      </BoardConfirmDialog>
    </section>
  );
}
