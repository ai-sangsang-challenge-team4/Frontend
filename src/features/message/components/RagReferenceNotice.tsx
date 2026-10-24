import { formatRegulationSource, type RegulationSearchResult, type RegulationSource } from '../replyReferences';
import { ExternalLinkIcon, ReferenceBookIcon } from './MessageIcons';

type RagReferenceNoticeProps = {
  onOpenReference: (source: RegulationSource) => void;
  result: RegulationSearchResult;
};

export function RagReferenceNotice({ onOpenReference, result }: RagReferenceNoticeProps) {
  return (
    <article>
      <span>
        <ReferenceBookIcon />
        <strong>관련 규정 및 근거</strong>
      </span>
      <div className="board-reply-check-reference">
          {result.status === 'found' ? (
            result.sources.map((source) => (
              <div className="board-rag-source" key={source.id}>
                <p><span>{formatRegulationSource(source)}</span>
                  {source.isExample ? <small>예시 문서 · 실제 학교 규정 아님</small> : null}
                  {source.isOutdated ? <span>구버전 문서일 수 있어 최신 규정을 함께 확인해 주세요.</span> : null}
                </p>
                <button aria-label={`${source.title} 원문 보기`} className="board-outline-button board-risk-action-button" onClick={() => onOpenReference(source)} type="button">
                  <span>원문 보기</span><ExternalLinkIcon />
                </button>
              </div>
            ))
          ) : result.status === 'not_found' ? (
            <p>관련 규정이 등록된 자료에 없어 AI 초안을 생성하지 않습니다. 직접 작성해 주세요.</p>
          ) : (
            <p>규정 검색이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.</p>
          )}
      </div>
    </article>
  );
}
