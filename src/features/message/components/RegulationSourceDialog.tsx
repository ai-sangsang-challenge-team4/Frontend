import { Button, Modal } from '../../../shared/components/ui';
import type { RegulationSource } from '../replyReferences';

export function RegulationSourceDialog({ onClose, source }: { onClose: () => void; source: RegulationSource | null }) {
  const originalUrl = source?.url && /^https?:\/\//i.test(source.url) && !source.isExample ? source.url : undefined;
  return (
    <Modal
      className="board-regulation-source-modal"
      description={source ? `${source.title} · ${source.version} · ${source.organization}` : undefined}
      footer={<Button onClick={onClose}>확인</Button>}
      onOpenChange={(open) => { if (!open) onClose(); }}
      open={Boolean(source)}
      size="lg"
      title="규정 원문 확인"
    >
      {source ? (
        <div className="board-regulation-source-content">
          {source.isExample ? <p className="board-regulation-source-notice">화면 확인용 예시 문서입니다. 실제 학교 규정이나 공식 원문이 아니며, 실제 문서는 연동 후 제공됩니다.</p> : null}
          {source.isOutdated ? <p className="board-regulation-source-notice" role="alert">이 출처는 구버전 자료입니다. 실제 답변에 적용하기 전에 최신 규정을 확인해 주세요.</p> : null}
          <dl><div><dt>문서</dt><dd>{source.title}</dd></div><div><dt>발행기관</dt><dd>{source.organization}</dd></div><div><dt>버전</dt><dd>{source.version}</dd></div><div><dt>참고 조항</dt><dd>{source.article}</dd></div></dl>
          {source.sections.map((section) => <section key={section.heading}><h3>{section.heading}</h3><p>{section.text}</p></section>)}
          {originalUrl ? <a href={originalUrl} rel="noopener noreferrer" target="_blank">발행기관 원문 열기</a> : <p>외부 원문 링크가 등록되지 않았습니다.</p>}
        </div>
      ) : null}
    </Modal>
  );
}
