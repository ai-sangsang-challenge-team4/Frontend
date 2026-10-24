import type { ReactNode } from 'react';
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
  onOpenProcedure: () => void;
  stageNotice: string;
  submitDisabled: boolean;
  templateEditor?: ReactNode;
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
  onOpenProcedure,
  stageNotice,
  submitDisabled,
  templateEditor,
}: ReplyEditorProps) {
  const replyTextareaDescription = [isLocked ? lockNoticeId : undefined, aiNoticeId]
    .filter(Boolean)
    .join(' ');

  if (isLocked) {
    return (
      <section className="board-reply-compose-panel board-template-locked" aria-labelledby={lockNoticeId}>
        <h2 id={lockNoticeId}>이 메시지는 개별 답변을 보낼 수 없습니다</h2>
        <p>작성 중인 내용이 모두 잠깁니다. 지정 검토자가 잠금을 해제하기 전까지 공식 절차를 먼저 확인해 주세요.</p>
        {draftText ? <p className="board-template-locked-preview">{draftText}</p> : null}
        <button className="board-composer-action-button" onClick={onOpenProcedure} type="button">절차 안내 보기</button>
      </section>
    );
  }

  return (
    <section className="board-reply-compose-panel">
      <div className="board-reply-compose-header">
        <label htmlFor={templateEditor ? undefined : 'board-reply-composer-input'}>선생님 답변</label>
        <span aria-live="polite">{draftStatusText}</span>
      </div>
      {templateEditor ?? <textarea
        aria-describedby={replyTextareaDescription || undefined}
        disabled={isLocked}
        id="board-reply-composer-input"
        onChange={(event) => onDraftChange(event.target.value)}
        placeholder="학부모에게 전달할 답변을 작성하세요."
        rows={11}
        value={draftText}
      />}
      <p className="board-reply-ai-note" id={aiNoticeId}>
        {stageNotice}
        <br />
        답변은 자동 전송되지 않습니다. 내용을 확인하고 필요한 수정을 마친 뒤 전송해 주세요.
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
