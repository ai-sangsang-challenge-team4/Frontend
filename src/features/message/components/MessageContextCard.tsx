import { RiskBadge } from './RiskBadge';
import { ProfileAvatar } from './ProfileAvatar';
import type { BoardThread } from '../types';
import { Badge, InformationTooltip } from '../../../shared/components/ui';
import { getAnalysisStatus, systemRiskTone } from '../messageRules';
import { RiskAnalysisNotice } from '../../risk-analysis/RiskAnalysisNotice';

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
          <span className="board-card-meta-label">시스템 분석 위험도<InformationTooltip label="AI 위험도 설명" content="규칙과 AI 문맥 분석을 바탕으로 산정한 위험도입니다. 잠정 분석은 규칙 결과만 제공하며 직접 검토가 필요합니다." /></span>
          {analysisStatus === 'ready' && analysis ? <RiskBadge level={systemRiskTone[analysis.systemRiskLevel]} /> : (
            <Badge size="sm">{analysisStatus === 'failed' ? '분석 확인 필요' : analysisStatus === 'loading' ? '분석 중' : '분석 대기'}</Badge>
          )}
        </div>
        {analysisStatus === 'ready' && analysis?.systemRiskScore != null ? <div className="board-card-meta"><span>시스템 위험 점수</span><strong>{analysis.systemRiskScore}/100</strong></div> : null}
        {analysis?.teacherReviewedRiskLevel && analysisStatus === 'ready' ? (
          <div className="board-card-meta"><span>교사 검토 위험도</span><RiskBadge level={systemRiskTone[analysis.teacherReviewedRiskLevel]} /></div>
        ) : null}
        <div className="board-card-meta">
          <span>최근 수신</span>
          <time dateTime={thread.latestAt}>{thread.latestAtLabel}</time>
        </div>
      </div>
      {analysisStatus === 'ready' && analysis ? <RiskAnalysisNotice metadata={analysis} /> : null}
    </div>
  );
}
