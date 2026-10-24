import { useCallback, useEffect, useId, useState } from 'react';
import { getApiErrorMessage, isAbortError } from '../../../shared/api';
import { StatusChip } from '../../../shared/components/ui';
import { useAuth } from '../../auth';
import {
  createEscalation,
  getAdminRecipients,
  getComplaintEscalation,
} from '../../escalation/api';
import {
  escalationStatusChip,
  formatEscalationTime,
  SHARE_REASON_MAX_LENGTH,
  teacherEscalationStatusLabel,
} from '../../escalation/escalationRules';
import type { AdminRecipient, ComplaintEscalation } from '../../escalation/escalationTypes';
import { useEscalationRequest } from '../../escalation/useEscalationRequest';
import { createEscalationSnapshot } from '../escalationSnapshot';
import type { BoardThread } from '../types';
import { BoardConfirmDialog } from './BoardConfirmDialog';
import { ExternalLinkIcon } from './MessageIcons';

type AdminShareSectionProps = {
  onShared: (threadId: string, escalation: { adminName: string; reason: string }) => void;
  thread: BoardThread;
};

export function AdminShareSection({ onShared, thread }: AdminShareSectionProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const request = useCallback((signal: AbortSignal) => getComplaintEscalation(thread.id, signal), [thread.id]);
  const { data: escalation, error, isInitialLoading, retry } = useEscalationRequest(request);
  const isShared = Boolean(escalation && escalation.status !== 'RETURNED_TO_TEACHER');

  return (
    <section className="board-risk-workflow-panel board-admin-share-panel" aria-label="관리자 공유">
      <div className="board-risk-section-header">
        <div>
          <AdminShareIcon />
          <h2 className="board-risk-section-title">관리자 공유</h2>
          {escalation ? (
            <StatusChip
              label={teacherEscalationStatusLabel[escalation.status]}
              size="sm"
              status={escalationStatusChip[escalation.status]}
            />
          ) : null}
        </div>
        <button
          className="board-outline-button board-risk-action-button board-admin-share-button"
          disabled={isInitialLoading || Boolean(error) || isShared}
          onClick={() => setIsDialogOpen(true)}
          type="button"
        >
          <span>{isShared ? '공유 완료' : '관리자에게 공유'}</span>
          <ExternalLinkIcon />
        </button>
      </div>

      {error ? (
        <p className="board-admin-share-error" role="alert">
          공유 상태를 확인하지 못했습니다.{' '}
          <button className="board-admin-share-retry" onClick={retry} type="button">다시 시도</button>
        </p>
      ) : escalation && isShared ? (
        <SharedSummary escalation={escalation} />
      ) : (
        <p>
          공동 검토가 필요하다고 판단되면 관리자에게 직접 공유할 수 있습니다. 관리자는 공유된
          메시지의 위험 분석 결과와 공유 사유만 확인할 수 있습니다.
        </p>
      )}

      <AdminShareDialog
        onClose={() => setIsDialogOpen(false)}
        onShared={(result) => {
          setIsDialogOpen(false);
          onShared(thread.id, result);
        }}
        open={isDialogOpen}
        thread={thread}
      />
    </section>
  );
}

function SharedSummary({ escalation }: { escalation: ComplaintEscalation }) {
  return (
    <dl className="board-admin-share-summary">
      <div>
        <dt>공유 대상</dt>
        <dd>{escalation.assignedAdminName}</dd>
      </div>
      <div>
        <dt>공유 시각</dt>
        <dd><time dateTime={escalation.sharedAt}>{formatEscalationTime(escalation.sharedAt)}</time></dd>
      </div>
      <div>
        <dt>공유 사유</dt>
        <dd>{escalation.reason}</dd>
      </div>
      {escalation.adminMemo ? (
        <div>
          <dt>관리자 메모</dt>
          <dd>{escalation.adminMemo}</dd>
        </div>
      ) : null}
    </dl>
  );
}

type AdminShareDialogProps = {
  onClose: () => void;
  onShared: (result: { adminName: string; reason: string }) => void;
  open: boolean;
  thread: BoardThread;
};

function AdminShareDialog({ onClose, onShared, open, thread }: AdminShareDialogProps) {
  const { user } = useAuth();
  const reasonId = useId();
  const descriptionId = useId();
  const [recipients, setRecipients] = useState<AdminRecipient[]>([]);
  const [reason, setReason] = useState('');
  const [shareOriginal, setShareOriginal] = useState(false);
  const [attachEvidence, setAttachEvidence] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const trimmedReason = reason.trim();
  const recipient = recipients[0];
  const hasOriginal = Boolean(thread.originalMessage?.trim());

  useEffect(() => {
    if (!open) {
      setReason('');
      setShareOriginal(false);
      setAttachEvidence(false);
      setErrorMessage(null);
      return;
    }
    const controller = new AbortController();
    getAdminRecipients(controller.signal)
      .then(setRecipients)
      .catch((error: unknown) => {
        if (!isAbortError(error)) setErrorMessage(getApiErrorMessage(error, '공유할 관리자를 불러오지 못했습니다.'));
      });
    return () => controller.abort();
  }, [open]);

  const handleSubmit = async () => {
    if (!recipient || !trimmedReason || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await createEscalation(thread.id, {
        assignedAdminId: recipient.userId,
        // The mock inbox has no package IDs yet; the server resolves the latest package.
        evidencePackageId: attachEvidence ? 1 : null,
        reason: trimmedReason,
        shareMaskedContent: true,
        shareOriginalContent: shareOriginal,
      }, { snapshot: createEscalationSnapshot(thread, user?.name ?? '담당 교사') });
      onShared({ adminName: recipient.name, reason: trimmedReason });
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, '관리자에게 공유하지 못했습니다. 다시 시도해 주세요.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BoardConfirmDialog
      actions={[
        { label: '취소', onClick: onClose },
        {
          disabled: !recipient || !trimmedReason || isSubmitting,
          label: isSubmitting ? '공유 중…' : '공유하기',
          onClick: handleSubmit,
          tone: 'primary',
        },
      ]}
      descriptionId={descriptionId}
      onClose={isSubmitting ? () => undefined : onClose}
      open={open}
      title="관리자에게 공유할까요?"
      titleId="board-admin-share-title"
    >
      <div className="board-admin-share-form">
        <p className="board-confirm-modal-copy" id={descriptionId}>
          {recipient ? `${recipient.name}(${recipient.role})` : '관리자'}에게 위험 분석 결과와 공유 사유가
          전달됩니다. 개인정보가 가려진 메시지가 기본으로 공유됩니다.
        </p>
        <label className="board-ai-objection-reason-label" htmlFor={reasonId}>
          공유 사유 <strong aria-hidden="true">*</strong>
        </label>
        <div className="board-risk-review-textarea-shell board-ai-objection-reason">
          <textarea
            aria-required="true"
            id={reasonId}
            maxLength={SHARE_REASON_MAX_LENGTH}
            onChange={(event) => setReason(event.target.value)}
            placeholder="관리자와 함께 검토가 필요한 이유를 적어 주세요."
            value={reason}
          />
          <span>{reason.length} / {SHARE_REASON_MAX_LENGTH}</span>
        </div>
        <fieldset className="board-ai-objection-types board-admin-share-options">
          <legend>함께 공유할 자료</legend>
          <label>
            <input checked disabled type="checkbox" />
            <span>개인정보가 가려진 메시지 (기본)</span>
          </label>
          <label>
            <input
              checked={shareOriginal}
              disabled={!hasOriginal}
              onChange={(event) => setShareOriginal(event.target.checked)}
              type="checkbox"
            />
            <span>원문 메시지</span>
          </label>
          <label>
            <input
              checked={attachEvidence}
              disabled={!thread.evidencePackageGenerated}
              onChange={(event) => setAttachEvidence(event.target.checked)}
              type="checkbox"
            />
            <span>{thread.evidencePackageGenerated ? '증빙 패키지' : '증빙 패키지 (생성 후 첨부 가능)'}</span>
          </label>
        </fieldset>
        {errorMessage ? <p className="board-admin-share-error" role="alert">{errorMessage}</p> : null}
      </div>
    </BoardConfirmDialog>
  );
}

function AdminShareIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13Zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5Z"
        fill="currentColor"
      />
    </svg>
  );
}
