import './AiJudgmentNotice.css';

export function AiJudgmentNotice() {
  return (
    <div className="ai-judgment-notice">
      <span aria-hidden="true" className="ai-judgment-notice-icon">i</span>
      <p>AI 판단은 참고 정보이며 오류가 있을 수 있습니다. 원문과 판단 근거를 직접 확인한 뒤 최종적으로 판단해 주세요.</p>
    </div>
  );
}
