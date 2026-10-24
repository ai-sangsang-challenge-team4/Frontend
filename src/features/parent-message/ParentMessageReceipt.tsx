import { useState } from 'react';
import { ArrowRight, Plus } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import completeIllustration from '../../shared/assets/parent/message-analysis.svg';
import { Button, EmptyState } from '../../shared/components/ui';
import { findSentMessage } from './messageDraft';
import { ParentMessageHeader } from './ParentMessageHeader';
import './ParentMessageReview.css';
import './ParentMessageReceipt.css';

export function ParentMessageReceipt({ userId, messageId }: { userId: number; messageId: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const justSent = location.state?.justSent === true;
  const [result] = useState(() => {
    try {
      return { message: findSentMessage(userId, messageId), error: null };
    } catch {
      return { message: null, error: '문의 정보를 불러오지 못했습니다. 다시 시도해 주세요.' };
    }
  });
  const message = result.message;
  const labels = { AI: 'AI 초안', ORIGINAL: '원문', CUSTOM: '직접 수정' };

  return (
    <>
      <ParentMessageHeader backLabel="문의 내역으로 돌아가기" onBack={() => navigate('/parent/messages')}
        title={justSent ? '전송 완료' : '문의 상세'} />
      <main className="layout-main parent-receipt">
        {message ? <>
          {justSent ? (
            <div className="parent-receipt-success" role="status">
              <img alt="" aria-hidden="true" src={completeIllustration} />
              <h2>문의가 전송되었습니다.</h2>
              <p>{message.teacherName}께 문의를 전달했습니다.</p>
            </div>
          ) : null}
          <dl className="parent-review-preview-meta parent-receipt-meta">
            <dt>문의 대상</dt><dd>{message.teacherName}</dd>
            <dt>문의 제목</dt><dd>{message.title}</dd>
            <dt>선택 문장</dt><dd>{labels[message.selectionType]}</dd>
            <dt>전송 일시</dt><dd><time dateTime={message.sentAt}>{new Date(message.sentAt).toLocaleString('ko-KR')}</time></dd>
          </dl>
          <section aria-label="전송한 문의 내용" className="parent-receipt-body"><p>{message.finalBody}</p></section>
          <div className="parent-receipt-actions">
            <Button leftIcon={<Plus size={20} />} onClick={() => navigate('/parent/messages/new')} variant="outline">새 문의 작성</Button>
            <Button onClick={() => navigate('/parent/messages')} rightIcon={<ArrowRight size={20} />}>문의 내역</Button>
          </div>
        </> : <EmptyState title={result.error ?? '문의를 찾을 수 없습니다.'}
          action={<Button onClick={() => navigate('/parent/messages')}>문의 내역</Button>} />}
      </main>
    </>
  );
}
