import { CalendarDays, ChevronUp, Info, Pencil } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import completeIllustration from '../../shared/assets/parent/message-analysis.svg';
import { ProfileAvatar } from '../message/components/ProfileAvatar';
import { mockConnectedTeachers, updateSentMessage } from './messageDraft';
import { Button, EmptyState, MessageText, StatusChip, Toast } from '../../shared/components/ui';
import { applyServerComplaintState, canWriteAdditionalInquiry, consultationChips, formatMessageDate, getConversation } from './conversation';
import { ParentMessageHeader } from './ParentMessageHeader';
import { ParentMessageComposer } from './ParentMessageComposer';
import { useParentMessages } from './useParentMessages';
import { complaintIdFromThreadId, prepareServerFollowUp, syncServerConversation } from './serverHistory';
import { useServerHistorySync } from './useServerHistorySync';
import { getApiErrorMessage, isApiError, useApiRequest } from '../../shared/api';
import { ApiErrorFallback, LoadingState } from '../../shared/components/feedback';
import { parentComplaintApi } from './api/parentComplaintApi';
import './ParentMessageHistory.css';
import './ParentMessageReceipt.css';

export function ParentMessageReceipt({ userId, messageId }: { userId: number; messageId: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const justSent = location.state?.justSent === true;
  const followUpOpen = location.state?.followUpOpen === true;
  const restoreFollowUpFocus = useRef(false);
  const conversationRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!followUpOpen && restoreFollowUpFocus.current) {
      (document.getElementById('parent-follow-up-trigger') ?? conversationRef.current)?.focus();
      restoreFollowUpFocus.current = false;
    }
  }, [followUpOpen]);
  function setFollowUpOpen(open: boolean) {
    restoreFollowUpFocus.current = !open;
    navigate(location.pathname, { replace: true, state: { ...location.state, followUpOpen: open } });
  }
  const { messages, error, refresh } = useParentMessages(userId);
  const message = messages.find((item) => item.messageId === messageId);
  // Loads the conversation with the teacher's replies; a link to an inquiry not stored here yet carries its ID.
  const sync = useServerHistorySync(userId, message ? message.serverComplaintId : complaintIdFromThreadId(messageId));
  const conversation = message ? getConversation(message) : [];
  const latest = conversation[conversation.length - 1];
  const teacherClassName = mockConnectedTeachers.find((teacher) => teacher.value === message?.teacherId)?.className;
  const [notice, setNotice] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const closing = useRef(false);
  const dismissNotice = useCallback(() => setNotice(null), []);
  const isAnswered = message?.serverComplaintStatus === 'ANSWERED' && message.serverWaitingFor === 'PARENT';
  const isWaitingForTeacher = sync.enabled && message?.serverComplaintStatus === 'OPEN' && message.serverWaitingFor === 'TEACHER';
  const serverActionsReady = sync.hasSynced && !sync.error;
  const canClose = sync.enabled ? serverActionsReady && isAnswered
    : latest?.authorRole === 'teacher' && message?.consultationStatus !== 'complete';
  const canFollowUp = !sync.enabled || (serverActionsReady &&
    canWriteAdditionalInquiry(message?.serverComplaintStatus, message?.serverWaitingFor));

  async function handleClose() {
    if (!message || !canClose || closing.current || followUpOpen) return;
    closing.current = true;
    setIsClosing(true);
    const complaintId = sync.enabled ? message.serverComplaintId : undefined;
    try {
      const state = complaintId !== undefined ? await parentComplaintApi.closeComplaint(complaintId) : null;
      try {
        let shouldReload = false;
        updateSentMessage(userId, messageId, (current) => {
          const lastMessage = getConversation(current).at(-1);
          if (lastMessage?.id !== latest?.id || (state && (current.serverComplaintStatus === 'OPEN' || current.updatedAt !== message.updatedAt))) {
            // The local change could be a real follow-up or an older read. Check the server after the close.
            shouldReload = state !== null;
            return current;
          }
          const confirmed = { ...current, parentAcknowledgedAt: new Date().toISOString(), needsTeacherReview: false };
          return state ? applyServerComplaintState(confirmed, state) : { ...confirmed, consultationStatus: 'complete' };
        });
        if (shouldReload) sync.retry();
        setNotice('문의가 완료되었습니다.');
      } catch {
        if (state) sync.retry();
        setNotice(state ? '문의가 완료되었습니다. 화면 표시를 다시 불러오고 있어요.' : '문의를 완료하지 못했습니다. 다시 시도해 주세요.');
      }
    } catch (error) {
      if (complaintId !== undefined && isApiError(error) && error.status === 409 && error.code === 'COMPLAINT_NOT_CLOSABLE') {
        try {
          await syncServerConversation(userId, complaintId);
        } catch {
          sync.retry();
        }
      }
      setNotice(getApiErrorMessage(error, '문의를 완료하지 못했습니다. 다시 시도해 주세요.'));
    } finally {
      closing.current = false;
      setIsClosing(false);
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
            <span><MessageText>{latest.body}</MessageText></span>
          </div>
          <div className="parent-conversation-card-meta-group">
            <div className="parent-conversation-card-meta">
              <span>상담 상태</span>
              <StatusChip label={isAnswered ? '답변 도착' : undefined} status={consultationChips[message.consultationStatus ?? 'before']} />
            </div>
            <div className="parent-conversation-card-meta">
              <span>최근 메시지</span>
              <time dateTime={latest.sentAt}>{formatMessageDate(latest.sentAt)}</time>
            </div>
          </div>
        </section>
        {sync.error ? <div className="parent-history-sync-error" role="alert">
          <p>{getApiErrorMessage(sync.error, '선생님 답변을 불러오지 못했습니다.')} 이 기기에 저장된 대화만 표시합니다.</p>
          <Button onClick={sync.retry} size="sm" variant="outline">다시 불러오기</Button>
        </div> : null}
        <div className="parent-conversation-notice"><Info aria-hidden="true" size={24} /><p>{isWaitingForTeacher
          ? '선생님의 답변을 기다리고 있어요. 답변이 도착하면 이 문의에서 추가 질문을 작성할 수 있습니다.'
          : '같은 내용에 대한 추가 질문은 이 문의에서 이어서 작성할 수 있습니다. 다른 내용은 새 문의로 작성해 주세요.'}</p></div>
        <section aria-label="전체 대화 내역" className="parent-conversation" ref={conversationRef} tabIndex={-1}>
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
                    <section aria-label={isParent ? '전송한 문의 내용' : '선생님 답변 내용'} className="parent-chat-bubble"><p><MessageText>{entry.body}</MessageText></p></section>
                    <time dateTime={entry.sentAt}>{new Date(entry.sentAt).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' })}</time>
                  </div>
                </article>
              </li>;
            })}
          </ol>
          <div className="parent-conversation-actions">
            <div className="parent-conversation-primary-actions">
              <div className="parent-conversation-action-buttons">
                {canClose ? <Button disabled={isClosing || followUpOpen} title={followUpOpen ? '추가 문의를 저장하고 접은 뒤 완료할 수 있어요.' : undefined} onClick={() => void handleClose()} variant="outline">{isClosing ? '완료 처리 중…' : '문의 완료'}</Button> : null}
                {canFollowUp && !followUpOpen ? <Button id="parent-follow-up-trigger" disabled={isClosing} aria-controls="parent-inline-follow-up" aria-expanded={false} leftIcon={<Pencil size={20} />} onClick={() => setFollowUpOpen(true)}>추가 문의하기</Button> : null}
              </div>
            </div>
            <div id="parent-inline-follow-up" hidden={!followUpOpen}>
              {followUpOpen ? <InlineFollowUp userId={userId} threadId={messageId} server={sync.enabled}
                draftId={location.state?.followUpDraftId} blocked={!canFollowUp || isClosing}
                onCollapse={() => setFollowUpOpen(false)} /> : null}
            </div>
          </div>
        </section>
        <p className="parent-conversation-new-inquiry">다른 내용으로 문의를 원하시나요? <Link to="/parent/messages/new?fresh=1">새 문의 작성</Link></p>
      </> : sync.isLoading ? <EmptyState title="문의를 불러오고 있습니다." /> : <EmptyState
        title={error ?? (sync.error ? getApiErrorMessage(sync.error, '문의를 불러오지 못했습니다.') : '문의를 찾을 수 없습니다.')}
        action={error ? <Button onClick={refresh}>다시 시도</Button> : sync.error ? <Button onClick={sync.retry}>다시 시도</Button> : <Button onClick={() => navigate('/parent/messages')}>문의 내역</Button>} />}
    </main>
    {notice ? <Toast message={notice} onClose={dismissNotice} /> : null}
  </>;
}

function InlineFollowUp({ userId, threadId, draftId, server, blocked, onCollapse }: {
  userId: number; threadId: string; draftId?: string; server: boolean; blocked: boolean; onCollapse: () => void;
}) {
  // Keep the legacy write route's fresh server-turn check before reading a draft.
  const request = useCallback(async (signal: AbortSignal) => server
    ? prepareServerFollowUp(userId, threadId, signal) : null, [server, userId, threadId]);
  const { data, error, isLoading, retry } = useApiRequest(request);
  if (isLoading || error || data?.canWrite === false) return <div className="parent-inline-composer">
    <div className="parent-inline-composer-heading">
      <h2>추가 문의 작성</h2>
      <Button className="parent-inline-composer-collapse" aria-label="추가 문의 입력창 접기"
        onClick={onCollapse} rightIcon={<ChevronUp size={18} />} variant="ghost">접기</Button>
    </div>
    {error ? <ApiErrorFallback error={error} homePath="/parent/messages" onRetry={retry} variant="section" />
      : isLoading ? <LoadingState message="추가 문의 가능 여부를 확인하고 있어요." />
        : <p role="status">선생님의 답변을 기다리고 있어요. 답변이 도착하면 추가 문의를 작성할 수 있습니다.</p>}
  </div>;
  return <ParentMessageComposer userId={userId} threadId={data?.threadId ?? threadId} draftId={draftId}
    embedded blocked={blocked} onCollapse={onCollapse} />;
}
