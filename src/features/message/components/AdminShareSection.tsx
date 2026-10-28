import { useCallback, useId, useState } from 'react';
import { getApiErrorMessage } from '../../../shared/api';
import { StatusChip } from '../../../shared/components/ui';
import type { EscalationScope } from '../../../shared/types';
import { canSendEscalationRequest, getEscalationState, shareEscalation } from '../../escalation/api';
import {
  apiRiskTone,
  escalationStatusChip,
  riskReviewStatusLabel,
  SHARE_REASON_MAX_LENGTH,
  SHAREABLE_RISK_LEVEL,
  teacherEscalationStatusLabel,
} from '../../escalation/escalationRules';
import type { EscalationStateResponse } from '../../escalation/escalationTypes';
import { useEscalationRequest } from '../../escalation/useEscalationRequest';
import { createEscalationSnapshot } from '../escalationSnapshot';
import { riskLabel } from '../messageRules';
import type { BoardThread } from '../types';
import { BoardConfirmDialog } from './BoardConfirmDialog';
import { ExternalLinkIcon } from './MessageIcons';

type AdminShareSectionProps = {
  onShared: (threadId: string, escalation: { reason: string }) => void;
  thread: BoardThread;
};

export function AdminShareSection({ onShared, thread }: AdminShareSectionProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  // Over HTTP a mock thread has no numeric complaintId, so nothing is requested.
  const isLinked = canSendEscalationRequest(thread.id);
  // Depends on the whole thread so a saved risk review refetches the server's current level.
  const request = useCallback(
    (signal: AbortSignal) => isLinked
      ? getEscalationState(thread.id, { signal, snapshot: createEscalationSnapshot(thread) })
      : Promise.resolve(null),
    [isLinked, thread],
  );
  const { data: state, error, isInitialLoading, retry } = useEscalationRequest(request);
  const isShared = Boolean(state && state.escalationStatus !== 'NOT_SHARED');
  const isShareable = state?.currentRiskLevel === SHAREABLE_RISK_LEVEL;

  return (
    <section className="board-risk-workflow-panel board-admin-share-panel" aria-label="관리자 공유">
      <div className="board-risk-section-header">
        <div>
          <AdminShareIcon />
          <h2 className="board-risk-section-title">관리자 공유</h2>
          {state && isShared ? (
            <StatusChip
              label={teacherEscalationStatusLabel[state.escalationStatus]}
              size="sm"
              status={escalationStatusChip[state.escalationStatus]}
            />
          ) : null}
        </div>
        <button
          className="board-outline-button board-risk-action-button board-admin-share-button"
          disabled={isInitialLoading || Boolean(error) || !isShareable || isShared}
          onClick={() => setIsDialogOpen(true)}
          type="button"
        >
          <span>{isShared ? '공유 완료' : '관리자에게 공유'}</span>
          <ExternalLinkIcon />
        </button>
      </div>

      {!isLinked ? (
        <p>서버에 등록된 민원이 아니어서 관리자 공유 상태를 확인하거나 공유할 수 없습니다.</p>
      ) : error ? (
        <p className="board-admin-share-error" role="alert">
          {getApiErrorMessage(error, '공유 상태를 확인하지 못했습니다.')}{' '}
          <button className="board-admin-share-retry" onClick={retry} type="button">다시 시도</button>
        </p>
      ) : state && isShared ? (
        <SharedSummary state={state} />
      ) : state && !isShareable ? (
        <p>현재 긴급 단계 메시지만 관리자에게 공유할 수 있습니다.</p>
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

function SharedSummary({ state }: { state: EscalationStateResponse }) {
  return (
    <dl className="board-admin-share-summary">
      <div>
        <dt>현재 위험도</dt>
        <dd>{riskLabel[apiRiskTone[state.currentRiskLevel]]} ({state.currentRiskScore}점)</dd>
      </div>
      {state.riskReviewStatus ? (
        <div>
          <dt>위험도 변경 요청</dt>
          <dd>{riskReviewStatusLabel[state.riskReviewStatus]}</dd>
        </div>
      ) : null}
    </dl>
  );
}

type AdminShareDialogProps = {
  onClose: () => void;
  onShared: (result: { reason: string }) => void;
  open: boolean;
  thread: BoardThread;
};

function AdminShareDialog({ onClose, onShared, open, thread }: AdminShareDialogProps) {
  const reasonId = useId();
  const descriptionId = useId();
  const [reason, setReason] = useState('');
  const [shareOriginal, setShareOriginal] = useState(false);
  const [attachEvidence, setAttachEvidence] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const trimmedReason = reason.trim();
  const hasOriginal = Boolean(thread.originalMessage?.trim());

  const close = () => {
    setReason('');
    setShareOriginal(false);
    setAttachEvidence(false);
    setErrorMessage(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!trimmedReason || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    const scopes: EscalationScope[] = [
      'MASKING_MESSAGES',
      ...(shareOriginal ? ['ORIGINAL_MESSAGES' as const] : []),
      ...(attachEvidence ? ['MEDIATION_PACKAGE' as const] : []),
    ];
    try {
      // adminId null: the server assigns the admin.
      await shareEscalation(
        thread.id,
        { adminId: null, reason: trimmedReason, scopes },
        { snapshot: createEscalationSnapshot(thread) },
      );
      setReason('');
      setShareOriginal(false);
      setAttachEvidence(false);
      onShared({ reason: trimmedReason });
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, '관리자에게 공유하지 못했습니다. 다시 시도해 주세요.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BoardConfirmDialog
      actions={[
        { label: '취소', onClick: close },
        {
          disabled: !trimmedReason || isSubmitting,
          label: isSubmitting ? '공유 중…' : '공유하기',
          onClick: handleSubmit,
          tone: 'primary',
        },
      ]}
      descriptionId={descriptionId}
      onClose={isSubmitting ? () => undefined : close}
      open={open}
      title="관리자에게 공유할까요?"
      titleId="board-admin-share-title"
    >
      <div className="board-admin-share-form">
        <p className="board-confirm-modal-copy" id={descriptionId}>
          담당 관리자에게 위험 분석 결과와 공유 사유가 전달됩니다. 개인정보가 가려진 메시지가 기본으로
          공유됩니다.
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
