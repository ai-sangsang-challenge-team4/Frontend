import type { ReactNode } from 'react';
import { Tabs } from '../../../shared/components/ui';
import type { ReplyDraftTab } from '../types';
import {
  ResetIcon,
  SaveIcon,
  SendIcon,
  WritingGuideIcon,
} from './MessageIcons';

type ReplyEditorProps = {
  activeDraftTab: ReplyDraftTab;
  aiNoticeId: string;
  assistButtonDisabled: boolean;
  assistButtonLabel: string;
  draftStatusText: string;
  draftText: string;
  hasDraft: boolean;
  isLocked: boolean;
  isDraftInputDisabled: boolean;
  isManualTabDisabled: boolean;
  // A request (AI draft, save, send) is in flight; the draft cannot change meanwhile.
  isBusy?: boolean;
  lockNoticeId: string;
  maxLength?: number;
  onAssist: () => void;
  onDraftChange: (value: string) => void;
  onDraftTabChange: (tab: ReplyDraftTab) => void;
  onDraftReset: () => void;
  onDraftSave: () => void;
  onSubmit: () => void;
  onOpenProcedure: () => void;
  saveDisabled?: boolean;
  // The official template button on the AI tab, or the AI draft button when the tab is empty.
  showAssistButton: boolean;
  stageNotice: string;
  submitDisabled: boolean;
  templateEditor?: ReactNode;
};

export function ReplyEditor({
  activeDraftTab,
  aiNoticeId,
  assistButtonDisabled,
  assistButtonLabel,
  draftStatusText,
  draftText,
  hasDraft,
  isLocked,
  isDraftInputDisabled,
  isManualTabDisabled,
  isBusy = false,
  lockNoticeId,
  maxLength,
  onAssist,
  onDraftChange,
  onDraftTabChange,
  onDraftReset,
  onDraftSave,
  onSubmit,
  onOpenProcedure,
  saveDisabled = false,
  showAssistButton,
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

  const draftEditor = templateEditor ?? <textarea
    aria-describedby={replyTextareaDescription || undefined}
    disabled={isDraftInputDisabled || isBusy}
    id="board-reply-composer-input"
    maxLength={maxLength}
    onChange={(event) => onDraftChange(event.target.value)}
    placeholder={isDraftInputDisabled
      ? 'AI 초안을 제공할 수 없습니다. 직접 작성 탭에서 답변을 작성해 주세요.'
      : '학부모에게 전달할 답변을 작성하세요.'}
    rows={11}
    value={draftText}
  />;

  return (
    <section className="board-reply-compose-panel">
      <div className="board-reply-compose-header">
        <label htmlFor={templateEditor ? undefined : 'board-reply-composer-input'}>선생님 답변</label>
        <span aria-live="polite">{draftStatusText}</span>
      </div>
      <Tabs
        ariaLabel="답변 작성 방식"
        className="board-reply-draft-tabs"
        items={[
          { value: 'ai', label: 'AI 초안 활용', content: draftEditor },
          { value: 'manual', label: '직접 작성', disabled: isManualTabDisabled, content: draftEditor },
        ]}
        onValueChange={(value) => onDraftTabChange(value as ReplyDraftTab)}
        value={activeDraftTab}
      />
      <div className="board-reply-notices">
        <p className="board-reply-ai-note" id={aiNoticeId}>
          {stageNotice}
          <br />
          답변은 자동 전송되지 않습니다. 내용을 확인하고 필요한 수정을 마친 뒤 전송해 주세요.
        </p>
        {!templateEditor && !isDraftInputDisabled ? (
          <p className="board-reply-draft-hint">
            {activeDraftTab === 'ai'
              ? 'AI 초안을 바탕으로 자유롭게 수정해 보세요.'
              : '학부모에게 전달할 답변을 직접 작성해 주세요.'}
          </p>
        ) : null}
      </div>
      <div className="board-reply-bottom-actions">
        <button
          className="board-composer-action-button"
          disabled={isLocked || isBusy || saveDisabled || !hasDraft}
          onClick={onDraftSave}
          type="button"
        >
          <SaveIcon />
          <span>임시저장</span>
        </button>
        <div className="board-composer-action-group">
          {activeDraftTab === 'ai' && showAssistButton ? <button
            className="board-composer-action-button"
            disabled={assistButtonDisabled || isBusy}
            onClick={onAssist}
            type="button"
          >
            <WritingGuideIcon />
            <span>{assistButtonLabel}</span>
          </button> : null}
          <button
            className="board-composer-action-button"
            disabled={isLocked || isBusy || !hasDraft}
            onClick={onDraftReset}
            type="button"
          >
            <ResetIcon />
            <span>초기화</span>
          </button>
          <button
            aria-describedby={isLocked ? lockNoticeId : undefined}
            className="board-composer-action-button board-composer-action-button--primary"
            disabled={isLocked || isBusy || !hasDraft || submitDisabled}
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
