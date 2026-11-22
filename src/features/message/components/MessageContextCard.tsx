import { RiskBadge } from './RiskBadge';
import { ProfileAvatar } from './ProfileAvatar';
import type { BoardThread } from '../types';
import { Badge } from '../../../shared/components/ui';
import { getAnalysisStatus, systemRiskTone } from '../messageRules';
import { RiskAnalysisNotice } from '../../risk-analysis/RiskAnalysisNotice';
import { AiRiskLabel } from '../../risk-analysis/AiRiskLabel';

type MessageContextCardProps = {
  thread: BoardThread;
  compact?: boolean;
};

export function MessageContextCard({ thread, compact = false }: MessageContextCardProps) {
  const analysisStatus = getAnalysisStatus(thread);
  const analysis = thread.analysis;
  const summary = thread.conversationSummary?.text ??
    (thread.serverComplaintId === undefined ? 'AI 요약을 준비하고 있습니다.' : '');
  return (
    <div className={`board-parent-card${compact ? ' board-parent-card--detail' : ''}`}>
      <div className="board-card-profile">
        <ProfileAvatar />
        <span>
          <strong>{thread.parentName}</strong>
          <small>{thread.className}</small>
        </span>
      </div>
      <div className="board-card-topic">
        <strong>{compact ? thread.title : thread.conversationSummary?.topic ?? thread.title}</strong>
        {summary ? <span>{summary}</span> : null}
      </div>
      <div className="board-card-meta-group">
        <div className="board-card-meta">
          {analysisStatus === 'ready' && analysis
            ? <AiRiskLabel audience="teacher" metadata={analysis} />
            : <span>위험도 분석 상태</span>}
          {analysisStatus === 'ready' && analysis ? <RiskBadge level={systemRiskTone[analysis.systemRiskLevel]} /> : (
            <Badge size="sm">{analysisStatus === 'failed' ? '분석 확인 필요' : analysisStatus === 'loading' ? '분석 중' : '분석 대기'}</Badge>
          )}
        </div>
        {analysis?.teacherReviewedRiskLevel && analysisStatus === 'ready' ? (
          <div className="board-card-meta"><span>교사 검토 위험도</span><RiskBadge level={systemRiskTone[analysis.teacherReviewedRiskLevel]} /></div>
        ) : null}
        {!compact ? <div className="board-card-meta">
          <span>최근 수신</span>
          <time dateTime={thread.latestAt}>{thread.latestAtLabel}</time>
        </div> : null}
      </div>
      {analysisStatus === 'ready' && analysis ? <RiskAnalysisNotice audience="teacher" metadata={analysis} /> : null}
    </div>
  );
}
