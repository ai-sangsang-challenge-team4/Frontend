import { useCallback, useState } from 'react';
import { FilePenLine, Search, Star } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../features/auth';
import { ProfileAvatar } from '../../features/message/components/ProfileAvatar';
import { mockConnectedTeachers, updateSentMessage, type MessageDraft } from '../../features/parent-message/messageDraft';
import { consultationChips, formatHistoryTime, formatMessageDate, getConversation, getDraftPath, needsParentReview } from '../../features/parent-message/conversation';
import { ParentMessageHeader } from '../../features/parent-message/ParentMessageHeader';
import { useParentMessages } from '../../features/parent-message/useParentMessages';
import { Badge, Button, EmptyState, Modal, StatusChip, Tabs, TextField, Toast } from '../../shared/components/ui';
import '../../features/parent-message/ParentMessageHistory.css';

export function MessageHistoryPage() {
  const { user } = useAuth();
  return user ? <MessageHistory key={user.userId} userId={user.userId} /> : null;
}

function MessageHistory({ userId }: { userId: number }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'all';
  const [query, setQuery] = useState('');
  const [resumeDraft, setResumeDraft] = useState<MessageDraft | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const dismissNotice = useCallback(() => setNotice(null), []);
  const { messages, drafts, error, refresh } = useParentMessages(userId);
  const teacherName = (id: string) => mockConnectedTeachers.find((teacher) => teacher.value === id)?.label ?? '선생님';
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matches = (values: string[]) => values.join(' ').toLocaleLowerCase().includes(normalizedQuery);
  const visibleMessages = messages.filter((message) => (tab !== 'starred' || message.isImportant) &&
    matches([message.teacherName, message.title, ...getConversation(message).map((entry) => entry.body)]));
  const visibleDrafts = drafts.filter((draft) => matches([teacherName(draft.teacherId), draft.title, draft.body]));

  function toggleImportant(messageId: string) {
    try {
      updateSentMessage(userId, messageId, (message) => ({ ...message, isImportant: !message.isImportant }));
    } catch {
      setNotice('중요 문의 설정을 저장하지 못했습니다. 다시 시도해 주세요.');
    }
  }

  const content = <>
    <div className="parent-history-toolbar">
      <TextField aria-label="문의 검색" containerClassName="parent-history-search" trailingIcon={<Search size={20} />}
        onChange={(event) => setQuery(event.target.value)} placeholder="선생님 성함 또는 문의 내용으로 검색" type="search" value={query} />
    </div>
    {error ? <EmptyState title={error} action={<Button onClick={refresh}>다시 시도</Button>} /> : (
      <>
        <p aria-live="polite" className="sr-only">{tab === 'drafts' ? '임시저장' : '문의'} {tab === 'drafts' ? visibleDrafts.length : visibleMessages.length}건</p>
        {tab === 'drafts' ? visibleDrafts.length ? (
          <ul aria-label="임시저장 문의 목록" className="parent-inquiry-list">
            {visibleDrafts.map((draft) => <li key={draft.messageId}>
              <button className="parent-draft-row" onClick={() => setResumeDraft(draft)} type="button">
                <FilePenLine aria-hidden="true" size={28} />
                <span className="parent-inquiry-copy"><strong>{draft.title.trim() || '제목 없는 문의'}</strong><span>{draft.body || '작성한 내용이 없습니다.'}</span><small>{teacherName(draft.teacherId)}{draft.threadId ? ' · 추가 문의' : ' · 새 문의'}</small></span>
                <span className="parent-inquiry-meta"><Badge>임시저장</Badge>{draft.savedAt ? <time dateTime={draft.savedAt}>{formatMessageDate(draft.savedAt)}</time> : null}</span>
              </button>
            </li>)}
          </ul>
        ) : <EmptyState title={query ? '검색 결과가 없습니다.' : '임시저장한 문의가 없습니다.'} /> : visibleMessages.length ? (
          <ul aria-label="문의 목록" className="parent-inquiry-list">
            {visibleMessages.map((message) => {
              const teacher = mockConnectedTeachers.find((item) => item.value === message.teacherId);
              const conversation = getConversation(message);
              return <li className="parent-inquiry-row" key={message.messageId}>
                <button aria-label={`${message.title} 중요 문의 ${message.isImportant ? '해제' : '등록'}`} aria-pressed={Boolean(message.isImportant)}
                  className={`parent-inquiry-star${message.isImportant ? ' is-important' : ''}`} onClick={() => toggleImportant(message.messageId)} type="button">
                  <Star aria-hidden="true" fill={message.isImportant ? 'currentColor' : 'none'} size={20} />
                </button>
                <Link className="parent-history-link parent-inquiry-link" to={`/parent/messages/${encodeURIComponent(message.messageId)}`}>
                  <span className="parent-inquiry-teacher"><ProfileAvatar className="parent-inquiry-avatar" /><span><strong>{message.teacherName}</strong><small>{teacher?.className ?? '문의 대상 교사'}</small></span></span>
                  <span className="parent-inquiry-copy"><span className="parent-inquiry-title-row"><strong>{message.title}</strong>{needsParentReview(message) ? <small className="parent-inquiry-recheck">재확인 필요</small> : null}</span><span>{conversation[conversation.length - 1].body}</span></span>
                  <span className="parent-inquiry-meta"><StatusChip status={consultationChips[message.consultationStatus ?? 'before']} /><time aria-label={formatMessageDate(message.sentAt)} dateTime={message.sentAt} title={formatMessageDate(message.sentAt)}>{formatHistoryTime(message.sentAt)}</time></span>
                </Link>
              </li>;
            })}
          </ul>
        ) : <EmptyState title={query ? '검색 결과가 없습니다.' : tab === 'starred' ? '중요 문의가 없습니다.' : '전송한 문의가 없습니다.'}
          description={query ? '선생님 성함이나 문의 내용을 다시 확인해 주세요.' : tab === 'starred' ? '문의 옆 별표를 눌러 중요 문의로 등록할 수 있습니다.' : '선생님께 문의를 작성하면 이곳에서 대화를 확인할 수 있습니다.'} />}
      </>
    )}
  </>;

  return <>
    <ParentMessageHeader showBack={false} showBreadcrumb={false} title="문의 내역" />
    <main className="layout-main parent-history-main">
      <Tabs ariaLabel="문의 분류" className="parent-history-tabs" value={tab}
        onValueChange={(value) => setParams(value === 'all' ? {} : { tab: value }, { replace: true })}
        items={[{ value: 'all', label: '전체 문의', content }, { value: 'starred', label: '중요 문의', content }, { value: 'drafts', label: '임시저장', content }]} />
    </main>
    <Modal className="parent-draft-dialog" open={resumeDraft !== null} onOpenChange={(open) => { if (!open) setResumeDraft(null); }}
      title="작성 중인 문의가 있어요." description="이어서 작성하시겠어요?" size="sm"
      footer={<Button onClick={() => { if (resumeDraft) navigate(getDraftPath(resumeDraft)); }}>이어서 작성</Button>}>
      <span className="sr-only">{resumeDraft?.title.trim() || '제목 없는 문의'}</span>
    </Modal>
    {notice ? <Toast message={notice} onClose={dismissNotice} /> : null}
  </>;
}
