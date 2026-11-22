import { Fragment, useId, useState } from 'react';
import { Badge, Button, Modal } from '../../shared/components/ui';
import { policyDocuments, type PolicyDocumentId } from './policyDocuments';
import './PolicyDocumentLinks.css';

export function PolicyDocumentLinks({ documents }: { documents: readonly PolicyDocumentId[] }) {
  const [selected, setSelected] = useState<PolicyDocumentId | null>(null);
  return <>
    <div aria-label="약관 전문 보기" className="policy-document-links" role="group">
      {documents.map((id, index) => <Fragment key={id}>
        {index > 0 ? <span aria-hidden="true" className="policy-document-separator">|</span> : null}
        <Button aria-haspopup="dialog" className="policy-document-link"
          onClick={() => setSelected(id)} size="sm" variant="ghost">{policyDocuments[id].title} 보기</Button>
      </Fragment>)}
    </div>
    {selected ? <PolicyDocumentModal documentId={selected} onClose={() => setSelected(null)} /> : null}
  </>;
}

function PolicyDocumentModal({ documentId, onClose }: { documentId: PolicyDocumentId; onClose: () => void }) {
  const headingPrefix = useId();
  const document = policyDocuments[documentId];
  return <Modal className="policy-document-modal" description="시행일 2026.11.22"
    footer={<Button onClick={onClose} variant="outline">닫기</Button>}
    onOpenChange={(open) => { if (!open) onClose(); }} open size="lg" title={document.title}>
    <article aria-label={`${document.title} 전문`} className="policy-document-content" tabIndex={0}>
      <dl className="policy-document-meta">
        <div><dt>서비스명</dt><dd>티처허브(TeacherHub)</dd></div>
        <div><dt>운영 주체</dt><dd>티처허브(TeacherHub)</dd></div>
        <div><dt>동의 구분</dt><dd><Badge size="sm" variant={documentId === 'service' ? 'brand' : 'neutral'}>{document.category}</Badge></dd></div>
      </dl>
      {document.introduction.map((text) => <p key={text}>{text}</p>)}
      {document.sections.map((section, index) => <section aria-labelledby={`${headingPrefix}-${index}`} key={section.title}>
        <h3 id={`${headingPrefix}-${index}`}>{section.title}</h3>
        {section.blocks.map((block, blockIndex) => {
          if (block.type === 'paragraph') return <p key={blockIndex}>{block.text}</p>;
          if (block.type === 'table') return <div className="policy-document-table" key={blockIndex}>
            <table><caption className="sr-only">{section.title}</caption>
              <thead><tr>{block.headers.map((header) => <th key={header} scope="col">{header}</th>)}</tr></thead>
              <tbody>{block.rows.map((row) => <tr key={row[0]}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody>
            </table>
          </div>;
          const List = block.type === 'ordered' ? 'ol' : 'ul';
          return <List key={blockIndex}>{block.items.map((item) => <li key={item}>{item}</li>)}</List>;
        })}
      </section>)}
      <p className="policy-document-acceptance">{document.acceptance}</p>
    </article>
  </Modal>;
}
