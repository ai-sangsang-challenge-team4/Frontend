import { CalendarDays, Info, Pencil } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import completeIllustration from '../../shared/assets/parent/message-analysis.svg';
import { ProfileAvatar } from '../message/components/ProfileAvatar';
import { mockConnectedTeachers, updateSentMessage } from './messageDraft';
import { Button, EmptyState, StatusChip, Toast } from '../../shared/components/ui';
import { consultationChips, formatMessageDate, getConversation } from './conversation';
import { ParentMessageHeader } from './ParentMessageHeader';
import { useParentMessages } from './useParentMessages';
import './ParentMessageHistory.css';
import './ParentMessageReceipt.css';

export function ParentMessageReceipt({ userId, messageId }: { userId: number; messageId: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const justSent = location.state?.justSent === true;
  const { messages, error, refresh } = useParentMessages(userId);
  const message = messages.find((item) => item.messageId === messageId);
  const conversation = message ? getConversation(message) : [];
  const latest = conversation[conversation.length - 1];
  const teacherClassName = mockConnectedTeachers.find((teacher) => teacher.value === message?.teacherId)?.className;
  const latestTeacherReply = conversation.filter((entry) => entry.authorRole === 'teacher').at(-1);
  const isAcknowledged = Boolean(message?.parentAcknowledgedAt && latestTeacherReply && message.parentAcknowledgedAt >= latestTeacherReply.sentAt);
  const [notice, setNotice] = useState<string | null>(null);
  const dismissNotice = useCallback(() => setNotice(null), []);

  // Records that the parent read the latest teacher reply; the consultation status stays with the teacher.
  function handleAcknowledge() {
    try {
      updateSentMessage(userId, messageId, (current) => ({ ...current, parentAcknowledgedAt: new Date().toISOString() }));
    } catch {
      setNotice('확인 여부를 저장하지 못했습니다. 다시 시도해 주세요.');
    }
  }

  return <>
    <ParentMessageHeader backLabel="문의 내역으로 돌아가기" onBack={() => navigate('/parent/messages')}
      title={justSent ? '전송 완료' : '문의 내역'} breadcrumbLabel="문의 내역" />
    <main className="layout-main parent-conversation-main">
      {message && justSent ? <div className="parent-receipt-success" role="status">
        <img alt="" aria-hidden="true" src={completeIllustration} />
        <h2>문의가 전송되었습니다.</h2>
        <p>{message.teacherName}께 문의를 전달했습니다.<br />'<Link to="/parent/messages">문의 내역</Link>'에서 해당 문의를 확인해 주세요.</p>
      </div> : message ? <>
        <section aria-label="문의 정보" className="parent-conversation-card">
          <div className="parent-conversation-card-profile">
            <ProfileAvatar className="parent-conversation-card-avatar" />
            <span><strong>{message.teacherName}</strong><small>{teacherClassName ?? '문의 대상 교사'}</small></span>
          </div>
          <div className="parent-conversation-card-topic">
            <strong>{message.title}</strong>
            <span>{latest.body}</span>
          </div>
          <div className="parent-conversation-card-meta-group">
            <div className="parent-conversation-card-meta">
              <span>상담 상태</span>
              <StatusChip status={consultationChips[message.consultationStatus ?? 'before']} />
            </div>
            <div className="parent-conversation-card-meta">
              <span>최근 메시지</span>
              <time dateTime={latest.sentAt}>{formatMessageDate(latest.sentAt)}</time>
            </div>
          </div>
        </section>
        <div className="parent-conversation-notice"><Info aria-hidden="true" size={24} /><p>같은 내용에 대한 추가 질문은 이 문의에서 이어서 작성할 수 있습니다. 다른 내용은 새 문의로 작성해 주세요.</p></div>
        <section aria-label="전체 대화 내역" className="parent-conversation">
          <ol className="parent-conversation-messages">
            {conversation.map((entry, index) => {
              const date = formatMessageDate(entry.sentAt, false);
              const showDate = index === 0 || formatMessageDate(conversation[index - 1].sentAt, false) !== date;
              const isParent = entry.authorRole === 'parent';
              return <li key={entry.id}>
                {showDate ? <div className="parent-conversation-date"><CalendarDays aria-hidden="true" size={20} /><time dateTime={entry.sentAt}>{new Date(entry.sentAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</time></div> : null}
                <article aria-label={isParent ? '학부모 메시지' : '교사 답변'} className={`parent-chat-message ${isParent ? 'is-parent' : 'is-teacher'}`}>
                  {!isParent ? <div className="parent-chat-author"><ProfileAvatar className="parent-chat-avatar" /><strong>{message.teacherName}</strong></div> : null}
                  <div className="parent-chat-row">
                    <section aria-label={isParent ? '전송한 문의 내용' : '선생님 답변 내용'} className="parent-chat-bubble"><p>{entry.body}</p></section>
                    <time dateTime={entry.sentAt}>{new Date(entry.sentAt).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' })}</time>
                  </div>
                </article>
              </li>;
            })}
          </ol>
          <div className="parent-conversation-actions">
            <div className="parent-conversation-primary-actions">
              <Button disabled={!latestTeacherReply || isAcknowledged} onClick={handleAcknowledge}
                title={latestTeacherReply ? undefined : '선생님 답변이 도착하면 확인할 수 있습니다.'} variant="outline">
                {isAcknowledged ? '확인 완료' : '확인했어요.'}
              </Button>
              <Button leftIcon={<Pencil size={20} />} onClick={() => navigate(`/parent/messages/${encodeURIComponent(messageId)}/follow-up`)}>추가 문의하기</Button>
            </div>
            <p>다른 내용으로 문의를 원하시나요? <Link to="/parent/messages/new?fresh=1">새 문의 작성</Link></p>
          </div>
        </section>
      </> : <EmptyState title={error ?? '문의를 찾을 수 없습니다.'}
        action={error ? <Button onClick={refresh}>다시 시도</Button> : <Button onClick={() => navigate('/parent/messages')}>문의 내역</Button>} />}
    </main>
    {notice ? <Toast message={notice} onClose={dismissNotice} /> : null}
  </>;
}
