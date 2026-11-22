import { useId, useRef, useState } from 'react';
import { getApiErrorMessage, type ApiError } from '../../../shared/api';
import { StatusChip } from '../../../shared/components/ui';
import type { EscalationScope } from '../../../shared/types';
import { canSendEscalationRequest, shareEscalation } from '../../escalation/api';
import {
  apiRiskTone,
  escalationStatusChip,
  riskReviewStatusLabel,
  SHARE_REASON_MAX_LENGTH,
  SHAREABLE_RISK_LEVEL,
  teacherEscalationStatusLabel,
} from '../../escalation/escalationRules';
import type { EscalationStateResponse } from '../../escalation/escalationTypes';
import { createEscalationSnapshot } from '../escalationSnapshot';
import { getThreadRiskLevel, hasOriginalMessage, riskLabel } from '../messageRules';
import type { BoardThread } from '../types';
import { BoardConfirmDialog } from './BoardConfirmDialog';
import { ExternalLinkIcon } from './MessageIcons';

// GET /teacher/complaints/{complaintId}/escalation, fetched once by the risk tab and shared with the review panel.
export type EscalationStateRequest = {
  data: EscalationStateResponse | null;
  error: ApiError | null;
  isInitialLoading: boolean;
  retry: () => void;
};

type AdminShareSectionProps = {
  escalation: EscalationStateRequest;
  onEvidencePackageCreate: (threadId: string, includeOriginalMessages?: boolean) => Promise<boolean>;
  onShared: (threadId: string, escalation: { reason: string }) => void;
  thread: BoardThread;
};

export function AdminShareSection({ escalation, onEvidencePackageCreate, onShared, thread }: AdminShareSectionProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  // Over HTTP a mock thread has no numeric complaintId, so nothing is requested.
  const isLinked = canSendEscalationRequest(thread.id);
  const { data: state, error, isInitialLoading, retry } = escalation;
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
      ) : state && (isShared || state.riskReviewStatus || state.safetyLock) ? (
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
        onEvidencePackageCreate={onEvidencePackageCreate}
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
      {state.currentRiskLevel ? (
        <div>
          <dt>현재 위험도</dt>
          <dd>
            {riskLabel[apiRiskTone[state.currentRiskLevel]]}
            {state.currentRiskScore == null ? '' : ` (${state.currentRiskScore}점)`}
          </dd>
        </div>
      ) : null}
      {state.riskReviewStatus ? (
        <div>
          <dt>위험도 변경 요청</dt>
          <dd>{riskReviewStatusLabel[state.riskReviewStatus]}</dd>
        </div>
      ) : null}
      {state.safetyLock ? (
        <div>
          <dt>안전 잠금</dt>
          <dd>유지 중 (관리자 해제 전까지 긴급 단계 정책 적용)</dd>
        </div>
      ) : null}
    </dl>
  );
}

type AdminShareDialogProps = {
  onClose: () => void;
  onEvidencePackageCreate: AdminShareSectionProps['onEvidencePackageCreate'];
  onShared: (result: { reason: string }) => void;
  open: boolean;
  thread: BoardThread;
};

function AdminShareDialog({ onClose, onEvidencePackageCreate, onShared, open, thread }: AdminShareDialogProps) {
  const reasonId = useId();
  const descriptionId = useId();
  const evidenceDescriptionId = useId();
  const [reason, setReason] = useState('');
  const [shareOriginal, setShareOriginal] = useState(false);
  const [attachEvidence, setAttachEvidence] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingEvidence, setIsCreatingEvidence] = useState(false);
  const evidencePendingRef = useRef(false);
  const isBusy = isSubmitting || isCreatingEvidence;
  const hasEvidence = thread.serverComplaintId !== undefined
    ? Boolean(thread.mediationPackage && !thread.mediationPackage.originalMessagesIncluded)
    : Boolean(thread.evidencePackageGenerated);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const trimmedReason = reason.trim();
  const hasOriginal = hasOriginalMessage(thread);
  const canCreateEvidence = Boolean(thread.analysis?.packageAvailable &&
    ['high', 'emergency'].includes(getThreadRiskLevel(thread)));

  const createAndAttachEvidence = async () => {
    if (isBusy || evidencePendingRef.current || !canCreateEvidence) return;
    evidencePendingRef.current = true;
    setIsCreatingEvidence(true);
    setErrorMessage(null);
    try {
      // Sharing scopes have no package ID field. Prepare a masked package independently of original sharing.
      if (await onEvidencePackageCreate(thread.id, false)) setAttachEvidence(true);
      else setErrorMessage('증빙 패키지를 준비하지 못했습니다. 다시 시도하거나 증빙 없이 공유해 주세요.');
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, '증빙 패키지를 생성하지 못했습니다. 다시 시도해 주세요.'));
    } finally {
      evidencePendingRef.current = false;
      setIsCreatingEvidence(false);
    }
  };

  const close = () => {
    setReason('');
    setShareOriginal(false);
    setAttachEvidence(false);
    setErrorMessage(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!trimmedReason || isBusy) return;
    if (attachEvidence && !hasEvidence) {
      setErrorMessage('증빙 패키지를 생성하거나 첨부 선택을 해제해 주세요.');
      return;
    }
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
        { disabled: isBusy, label: '취소', onClick: close },
        {
          disabled: !trimmedReason || isBusy,
          label: isSubmitting ? '공유 중…' : '공유하기',
          onClick: handleSubmit,
          tone: 'primary',
        },
      ]}
      descriptionId={descriptionId}
      onClose={isBusy ? () => undefined : close}
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
            disabled={isBusy}
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
              disabled={!hasOriginal || isBusy}
              onChange={(event) => setShareOriginal(event.target.checked)}
              type="checkbox"
            />
            <span>원문 메시지</span>
          </label>
          <div className="board-admin-share-evidence">
            {hasEvidence ? <label>
              <input
                aria-describedby={evidenceDescriptionId}
                checked={attachEvidence}
                disabled={isBusy}
                onChange={(event) => setAttachEvidence(event.target.checked)}
                type="checkbox"
              />
              <span>증빙 패키지</span>
            </label> : <button
              aria-describedby={evidenceDescriptionId}
              className="board-outline-button"
              disabled={!canCreateEvidence || isBusy}
              onClick={createAndAttachEvidence}
              type="button"
            >{isCreatingEvidence ? '증빙 패키지 생성 중…' : '증빙 패키지 생성 후 첨부'}</button>}
            <p id={evidenceDescriptionId}>개인정보가 가려진 메시지, 위험 분석과 처리 기록을 묶습니다. 원문은 패키지에 포함하지 않습니다. 증빙 없이도 공유할 수 있습니다.</p>
            {!hasEvidence && !canCreateEvidence ? <p>현재 이 메시지의 증빙 패키지를 생성할 수 없습니다.</p> : null}
            {attachEvidence ? <p role="status">증빙 패키지를 공유할 자료로 선택했습니다.</p> : null}
          </div>
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
