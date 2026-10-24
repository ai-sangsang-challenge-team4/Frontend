import {
  ResetIcon,
  SaveIcon,
  SendIcon,
  SparkleIcon,
  WritingGuideIcon,
} from './MessageIcons';

type ReplyEditorProps = {
  aiNoticeId: string;
  assistButtonDisabled: boolean;
  assistButtonLabel: string;
  draftStatusText: string;
  draftText: string;
  hasDraft: boolean;
  isLocked: boolean;
  isOfficialTemplateAvailable: boolean;
  lockNoticeId: string;
  onAssist: () => void;
  onDraftChange: (value: string) => void;
  onDraftReset: () => void;
  onDraftSave: () => void;
  onSubmit: () => void;
  stageNotice: string;
  submitDisabled: boolean;
};

export function ReplyEditor({
  aiNoticeId,
  assistButtonDisabled,
  assistButtonLabel,
  draftStatusText,
  draftText,
  hasDraft,
  isLocked,
  isOfficialTemplateAvailable,
  lockNoticeId,
  onAssist,
  onDraftChange,
  onDraftReset,
  onDraftSave,
  onSubmit,
  stageNotice,
  submitDisabled,
}: ReplyEditorProps) {
  const replyTextareaDescription = [isLocked ? lockNoticeId : undefined, aiNoticeId]
    .filter(Boolean)
    .join(' ');

  return (
    <section className="board-reply-compose-panel">
      <div className="board-reply-compose-header">
        <label htmlFor="board-reply-composer-input">선생님 답변</label>
        <span aria-live="polite">{draftStatusText}</span>
      </div>
      {isLocked ? (
        <p className="board-reply-lock-notice" id={lockNoticeId}>
          긴급 단계로 잠긴 메시지는 지정 검토자가 잠금을 해제하기 전까지
          답변을 생성하거나 전송할 수 없습니다. 위험 요소 탭에서 공식 절차를
          확인해 주세요.
        </p>
      ) : null}
      <textarea
        aria-describedby={replyTextareaDescription || undefined}
        disabled={isLocked}
        id="board-reply-composer-input"
        onChange={(event) => onDraftChange(event.target.value)}
        placeholder="학부모에게 전달할 답변을 작성하세요."
        rows={11}
        value={draftText}
      />
      <p className="board-reply-ai-note" id={aiNoticeId}>
        {stageNotice}
        <br />
        생성되거나 적용된 답변은 자동 전송되지 않으며, 교사가 직접 수정한
        내용만 최종 전송됩니다.
      </p>
      <div className="board-reply-bottom-actions">
        <button
          className="board-composer-action-button"
          disabled={isLocked || !hasDraft}
          onClick={onDraftSave}
          type="button"
        >
          <SaveIcon />
          <span>임시저장</span>
        </button>
        <div className="board-composer-action-group">
          <button
            className="board-composer-action-button"
            disabled={assistButtonDisabled}
            onClick={onAssist}
            type="button"
          >
            {isOfficialTemplateAvailable ? <WritingGuideIcon /> : <SparkleIcon />}
            <span>{assistButtonLabel}</span>
          </button>
          <button
            className="board-composer-action-button"
            disabled={isLocked || !hasDraft}
            onClick={onDraftReset}
            type="button"
          >
            <ResetIcon />
            <span>초기화</span>
          </button>
          <button
            aria-describedby={isLocked ? lockNoticeId : undefined}
            className="board-composer-action-button board-composer-action-button--primary"
            disabled={isLocked || !hasDraft || submitDisabled}
            onClick={onSubmit}
            type="button"
          >
            <SendIcon />
            <span>검토 후 전송</span>
          </button>
        </div>
      </div>
    </section>
  );
}
