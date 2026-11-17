import { CircleAlert, FileSearch, LoaderCircle } from 'lucide-react';
import { Button } from '../../../shared/components/ui';
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
  const Icon = status === 'loading' ? LoaderCircle : status === 'failed' ? CircleAlert : FileSearch;
  return (
    <section className={`board-analysis-state board-analysis-state--${status}`} role={status === 'failed' ? 'alert' : 'status'} aria-busy={status === 'loading'}>
      <Icon aria-hidden="true" className="board-analysis-state-icon" size={20} />
      <div className="board-analysis-state-copy">
        <h2>{status === 'loading' ? 'AI 분석 결과를 불러오고 있어요' : status === 'failed' ? 'AI 분석 결과를 확인하지 못했습니다' : 'AI 분석 결과가 아직 없습니다'}</h2>
        <p>{status === 'loading'
          ? '위험 요소와 판단 근거를 준비하고 있습니다. 잠시만 기다려 주세요.'
          : '위험 요소가 없다는 의미는 아닙니다. 잠시 후 메시지를 다시 열어 결과를 확인해 주세요.'}</p>
        {!canInspectOriginal && status !== 'loading' ? <p>
          {status === 'failed' ? '원문 열람 정보도 확인하지 못했습니다.' : '현재 원문을 열람할 수 없습니다.'}
        </p> : null}
        {(status === 'failed' && onRetry) || (canInspectOriginal && onOriginalOpen) ? (
          <div className="board-analysis-state-actions">
            {status === 'failed' && onRetry ? <Button onClick={onRetry} size="sm" variant="outline">다시 불러오기</Button> : null}
            {canInspectOriginal && onOriginalOpen ? <Button onClick={onOriginalOpen} size="sm" variant="outline">원문 보기</Button> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
