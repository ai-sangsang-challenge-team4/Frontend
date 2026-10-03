import {
  CheckPointIcon,
  ReplyCheckAlertIcon,
  WritingGuideIcon,
} from './MessageIcons';
import { RagReferenceNotice } from './RagReferenceNotice';

type ReplyCheckPanelProps = {
  isOpen: boolean;
  onOpenReference: () => void;
  onToggle: () => void;
};

export function ReplyCheckPanel({
  isOpen,
  onOpenReference,
  onToggle,
}: ReplyCheckPanelProps) {
  return (
    <section className={`board-reply-check-panel${isOpen ? ' is-open' : ''}`}>
      <div className="board-reply-check-heading">
        <div className="board-reply-check-alert">
          <ReplyCheckAlertIcon />
          <p>답변 전 확인이 필요한 내용을 확인해 주세요.</p>
        </div>
        <button
          aria-expanded={isOpen}
          className="board-reply-check-toggle"
          onClick={onToggle}
          type="button"
        >
          <span>{isOpen ? '접기' : '자세히 보기'}</span>
          <svg
            aria-hidden="true"
            className={isOpen ? 'is-open' : ''}
            fill="none"
            viewBox="0 0 13 7"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M0 1.0552L1.15375 0L6.5 4.8896L11.8463 0L13 1.0552L6.5 7L0 1.0552Z"
              fill="currentColor"
            />
          </svg>
        </button>
      </div>

      {isOpen ? (
        <div className="board-reply-check-content">
          <article>
            <span>
              <CheckPointIcon />
              <strong>주의 포인트</strong>
            </span>
            <p>
              <span>추측 또는 단정적인 표현은 피하세요.</span>
              <span>내용을 충분히 검토한 뒤 전송해주세요.</span>
            </p>
          </article>
          <article>
            <span>
              <WritingGuideIcon />
              <strong>답변 작성 가이드</strong>
            </span>
            <p>
              <span>사실로 확인되지 않은 내용은 단정하지 마세요.</span>
              <span>향후 진행 조치와 확인 절차를 명확히 설명하세요.</span>
              <span>상담 가능한 일정(시간)을 제안하세요.</span>
            </p>
          </article>
          <RagReferenceNotice onOpenReference={onOpenReference} />
        </div>
      ) : null}
    </section>
  );
}
