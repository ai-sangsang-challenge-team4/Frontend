import { ExternalLinkIcon, ReferenceBookIcon } from './MessageIcons';

type RagReferenceNoticeProps = {
  onOpenReference: () => void;
};

export function RagReferenceNotice({ onOpenReference }: RagReferenceNoticeProps) {
  return (
    <article>
      <span>
        <ReferenceBookIcon />
        <strong>관련 규정 및 근거</strong>
      </span>
      <div className="board-reply-check-reference">
        <p>
          <span>제3조(상담 운영 시간), 제4조(상담 신청)</span>
        </p>
        <button
          className="board-outline-button board-risk-action-button"
          onClick={onOpenReference}
          type="button"
        >
          <span>자세히 보기</span>
          <ExternalLinkIcon />
        </button>
      </div>
    </article>
  );
}
