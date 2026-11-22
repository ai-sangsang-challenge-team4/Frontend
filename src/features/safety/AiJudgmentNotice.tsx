import './AiJudgmentNotice.css';

export function AiJudgmentNotice({ inline = false, id, hasAiDraft = false }: { inline?: boolean; id?: string; hasAiDraft?: boolean }) {
  return (
    <div className={`ai-judgment-notice${inline ? ' ai-judgment-notice--inline' : ''}`} id={id}>
      {!inline ? <span aria-hidden="true" className="ai-judgment-notice-icon">i</span> : null}
      <p>{inline
        ? hasAiDraft
          ? 'AI가 생성한 초안은 교사가 직접 검토·수정한 후 전송해야 합니다.'
          : '답변을 작성한 뒤 내용을 직접 검토·수정하고 전송해 주세요.'
        : 'AI 판단은 참고 정보이며 오류가 있을 수 있습니다. 원문과 판단 근거를 직접 확인한 뒤 최종적으로 판단해 주세요.'}</p>
    </div>
  );
}
