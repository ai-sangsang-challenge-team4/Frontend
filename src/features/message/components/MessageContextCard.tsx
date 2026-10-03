import { RiskBadge } from './RiskBadge';
import { ProfileAvatar } from './ProfileAvatar';
import type { BoardThread } from '../types';

type MessageContextCardProps = {
  thread: BoardThread;
};

export function MessageContextCard({ thread }: MessageContextCardProps) {
  return (
    <div className="board-parent-card">
      <div className="board-card-profile">
        <ProfileAvatar />
        <span>
          <strong>{thread.parentName}</strong>
          <small>{thread.className}</small>
        </span>
      </div>
      <div className="board-card-topic">
        <strong>{thread.title}</strong>
        <span>{thread.latestMessage}</span>
      </div>
      <div className="board-card-meta-group">
        <div className="board-card-meta">
          <span>위험도</span>
          <RiskBadge level={thread.risk} />
        </div>
        <div className="board-card-meta">
          <span>최근 수신</span>
          <time dateTime={thread.latestAt}>{thread.latestAtLabel}</time>
        </div>
      </div>
    </div>
  );
}
