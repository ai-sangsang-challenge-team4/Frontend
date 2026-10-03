import { ProfileAvatar } from './ProfileAvatar';
import type { BoardThread } from '../types';

type BufferedSummaryCardProps = {
  canInspectOriginal: boolean;
  onOpenOriginal: () => void;
  onOpenRiskEvidence: () => void;
  summaryText: string;
  thread: BoardThread;
};

function BufferedSummaryIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 18 23"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M9 13.5681c-.15742 0-.2661.0474-.35938.1406C8.54735 13.802 8.5 13.9107 8.5 14.0681c0 .1574.04735.2661.14062.3594.09328.0933.20196.1406.35938.1406s.2661-.0473.35938-.1406c.09326-.0933.14062-.202.14062-.3594 0-.1574-.04735-.2661-.14062-.3594-.09328-.0932-.20196-.1406-.35938-.1406Zm-.5-3h1v-4h-1v4Zm9-0.4004c0 2.6404-.7888 5.0478-2.3584 7.2071-1.5717 2.162-3.5807 3.5646-6.01953 4.1787L9 21.5837l-.12207-.0302c-2.43885-.6141-4.44784-2.0167-6.01953-4.1787C1.2888 15.2155.5 12.8081.5 10.1677V3.72144l.324219-.1211 8-3L9 .533936l.17578.066406 8 3 .32422.121098v6.44626Z"
        fill="currentColor"
        stroke="white"
      />
    </svg>
  );
}

export function BufferedSummaryCard({
  canInspectOriginal,
  onOpenOriginal,
  onOpenRiskEvidence,
  summaryText,
  thread,
}: BufferedSummaryCardProps) {
  return (
    <article className="board-moderation-message">
      <div className="board-reply-author">
        <ProfileAvatar className="board-mini-avatar" />
        <strong>{thread.parentName}</strong>
      </div>
      <div className="board-moderation-row">
        <div className="board-moderation-card">
          <div>
            <strong className="board-moderation-title">
              <BufferedSummaryIcon />
              <span>위험 메시지 완충 요약</span>
            </strong>
            <p>{summaryText}</p>
          </div>
          <div className="board-moderation-actions">
            <button
              disabled={!canInspectOriginal}
              onClick={onOpenOriginal}
              type="button"
            >
              원문 보기
            </button>
            <button onClick={onOpenRiskEvidence} type="button">
              판단 근거
            </button>
          </div>
        </div>
        <time>{thread.replies[0]?.time ?? thread.latestAtLabel}</time>
      </div>
    </article>
  );
}
