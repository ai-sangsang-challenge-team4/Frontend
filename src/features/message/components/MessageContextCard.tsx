import { RiskBadge } from './RiskBadge';
import { ProfileAvatar } from './ProfileAvatar';
import type { BoardThread } from '../types';
import { Badge } from '../../../shared/components/ui';
import { getAnalysisStatus, systemRiskTone } from '../messageRules';

type MessageContextCardProps = {
  thread: BoardThread;
};

export function MessageContextCard({ thread }: MessageContextCardProps) {
  const analysisStatus = getAnalysisStatus(thread);
  const analysis = thread.analysis;
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
        <strong>{thread.conversationSummary?.topic ?? thread.title}</strong>
        <span>{thread.conversationSummary?.text ?? 'AI 요약을 준비하고 있습니다.'}</span>
      </div>
      <div className="board-card-meta-group">
        <div className="board-card-meta">
          <span>AI 최종 위험도</span>
          {analysisStatus === 'ready' && analysis ? <RiskBadge level={systemRiskTone[analysis.systemRiskLevel]} /> : (
            <Badge size="sm">{analysisStatus === 'failed' ? '분석 확인 필요' : analysisStatus === 'loading' ? '분석 중' : '분석 대기'}</Badge>
          )}
        </div>
        {analysis?.teacherReviewedRiskLevel && analysisStatus === 'ready' ? (
          <div className="board-card-meta"><span>교사 검토 위험도</span><RiskBadge level={systemRiskTone[analysis.teacherReviewedRiskLevel]} /></div>
        ) : null}
        <div className="board-card-meta">
          <span>최근 수신</span>
          <time dateTime={thread.latestAt}>{thread.latestAtLabel}</time>
        </div>
      </div>
    </div>
  );
}
