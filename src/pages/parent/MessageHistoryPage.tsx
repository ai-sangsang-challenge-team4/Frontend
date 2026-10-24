import { useState } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth';
import { readSentMessages } from '../../features/parent-message/messageDraft';
import { ParentMessageHeader } from '../../features/parent-message/ParentMessageHeader';
import { Badge, Button, EmptyState } from '../../shared/components/ui';
import '../../features/parent-message/ParentMessageReceipt.css';

export function MessageHistoryPage() {
  const { user } = useAuth();
  return user ? <MessageHistory key={user.userId} userId={user.userId} /> : null;
}

function MessageHistory({ userId }: { userId: number }) {
  const navigate = useNavigate();
  const [result] = useState(() => {
    try {
      return { messages: readSentMessages(userId), error: null };
    } catch {
      return { messages: [], error: '문의 내역을 불러오지 못했습니다. 다시 시도해 주세요.' };
    }
  });
  return (
    <>
      <ParentMessageHeader title="문의 내역" />
      <main className="layout-main">
        <div className="parent-history-heading">
          <Button leftIcon={<Plus size={20} />} onClick={() => navigate('/parent/messages/new')}>새 문의 작성</Button>
        </div>
        {result.messages.length > 0 ? (
          <ul className="parent-history-list">
            {result.messages.map((message) => (
              <li key={message.messageId}>
                <Link className="parent-history-link" to={`/parent/messages/${message.messageId}`}>
                  <span className="parent-history-link-copy">
                    <strong>{message.title}</strong>
                    <small>{message.teacherName} · <time dateTime={message.sentAt}>{new Date(message.sentAt).toLocaleString('ko-KR')}</time></small>
                  </span>
                  <Badge variant="success">전송 완료</Badge>
                  <ChevronRight aria-hidden="true" size={20} />
                </Link>
              </li>
            ))}
          </ul>
        ) : <EmptyState title={result.error ?? '전송한 문의가 없습니다.'} />}
      </main>
    </>
  );
}
