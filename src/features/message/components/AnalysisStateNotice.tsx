import { getAnalysisStatus, hasOriginalMessage } from '../messageRules';
import type { BoardThread } from '../types';

export function AnalysisStateNotice({ thread, onOriginalOpen, onRetry }: {
  thread: BoardThread;
  onOriginalOpen?: () => void;
  // Server inbox: reloads the thread's detail after a failed request.
  onRetry?: () => void;
}) {
  const status = getAnalysisStatus(thread);
  if (status === 'ready') return null;
  const canInspectOriginal = thread.analysis?.canViewOriginal &&
    thread.analysis.originalMessageAvailable && hasOriginalMessage(thread);
  return (
    <section className="board-analysis-state board-risk-evidence-panel" role={status === 'failed' ? 'alert' : 'status'} aria-busy={status === 'loading'}>
      <h2>{status === 'loading' ? 'AI 메시지 분석 중입니다' : status === 'failed' ? 'AI 분석 결과를 확인하지 못했습니다' : 'AI 분석 결과가 아직 없습니다'}</h2>
      <p>{status === 'loading'
        ? '분석이 완료되면 위험 요소와 판단 근거를 확인할 수 있습니다.'
        : '위험 요소가 없다는 의미는 아닙니다. 잠시 후 메시지를 다시 열어 결과를 확인해 주세요.'}</p>
      {status === 'failed' && onRetry ? (
        <button className="board-outline-button" onClick={onRetry} type="button">다시 불러오기</button>
      ) : null}
      {canInspectOriginal && onOriginalOpen ? (
        <button className="board-outline-button" onClick={onOriginalOpen} type="button">원문 보기</button>
      ) : !canInspectOriginal ? <p>원문 열람 권한이 없거나 원문이 제공되지 않았습니다.</p> : null}
    </section>
  );
}
