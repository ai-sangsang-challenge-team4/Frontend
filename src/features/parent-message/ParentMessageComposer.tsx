import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ChevronDown, LockKeyhole, Save, Send } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import analysisIllustration from '../../shared/assets/parent/message-analysis.svg';
import { Button, EmptyState, Select, TextareaField, TextField, Toast } from '../../shared/components/ui';
import { findSentMessage, mockConnectedTeachers, readMessageDraft, readMessageDrafts, saveMessageDraft, type MessageDraft } from './messageDraft';
import { ParentMessageHeader } from './ParentMessageHeader';
import { analyzeParentMessage } from './parentMessageApi';
import { createMessageReview, MESSAGE_MAX_LENGTH } from './parentMessageTypes';
import { getDraftPath } from './conversation';
import { checkPersonalInfo, maskContactInfo, MaskingError, PrivacyMaskingNotice } from '../pii';
import './ParentMessageComposer.css';

type FieldName = 'teacherId' | 'title' | 'body';
type FieldErrors = Partial<Record<FieldName, string>>;

export function ParentMessageComposer({ userId, threadId, draftId, fresh = false }: {
  userId: number; threadId?: string; draftId?: string; fresh?: boolean;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [initial] = useState(() => {
    try {
      const thread = threadId ? findSentMessage(userId, threadId) : null;
      const saved = draftId ? readMessageDraft(userId, draftId) : fresh ? null : threadId
        ? readMessageDrafts(userId).find((item) => item.threadId === threadId) : readMessageDraft(userId);
      const matching = saved && saved.threadId === threadId ? saved : null;
      return { thread, saved: matching, unavailable: Boolean((threadId && !thread) || (draftId && !matching)) };
    } catch {
      return { thread: null, saved: null, unavailable: true };
    }
  });
  const [draft, setDraft] = useState<MessageDraft>(() => initial.saved ?? {
    messageId: crypto.randomUUID(), teacherId: initial.thread?.teacherId ?? mockConnectedTeachers[0]?.value ?? '',
    title: initial.thread?.title ?? '', body: '', status: 'DRAFT', threadId,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [maskingFailed, setMaskingFailed] = useState(false);
  const [notice, setNotice] = useState<string | null>(location.state?.draftSaved ? '문의가 임시저장되었습니다.' : null);
  const analysisPending = useRef(false);
  const loadingTitle = useRef<HTMLParagraphElement>(null);
  const dismissNotice = useCallback(() => setNotice(null), []);

  useEffect(() => {
    if (!isAnalyzing) return;
    loadingTitle.current?.focus();
    window.scrollTo({ top: 0, behavior: 'instant' });

    const controller = new AbortController();
    const analyze = async () => {
      let review;
      try {
        review = createMessageReview(await analyzeParentMessage(draft, controller.signal));
      } catch (failure) {
        if (controller.signal.aborted) return;
        if (failure instanceof MaskingError) {
          analysisPending.current = false;
          setMaskingFailed(true);
          setIsAnalyzing(false);
          return;
        }
        review = createMessageReview({ status: 'failed', revisedText: null, risks: [], meaningWarning: null });
      }
      if (controller.signal.aborted) return;
      try {
        saveMessageDraft(userId, { ...draft, status: 'PARENT_REVIEW', review });
        navigate(`/parent/messages/${draft.messageId}/review`);
      } catch {
        analysisPending.current = false;
        setIsAnalyzing(false);
        setNotice('작성한 내용을 저장하지 못했습니다. 다시 시도해 주세요.');
      }
    };
    void analyze();

    return () => controller.abort();
  }, [draft, isAnalyzing, navigate, userId]);

  function updateField(field: FieldName, value: string) {
    setDraft((previous) => ({ ...previous, [field]: value, status: 'DRAFT', review: undefined }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
    setMaskingFailed(false);
  }

  function handleSaveDraft() {
    if (!draft.title.trim() && !draft.body.trim()) {
      setNotice('임시저장할 제목이나 내용을 입력해 주세요.');
      return;
    }
    try {
      saveMessageDraft(userId, { ...draft, status: 'DRAFT' });
      setNotice('문의가 임시저장되었습니다.');
      if (fresh) navigate(getDraftPath(draft), { replace: true, state: { draftSaved: true } });
    } catch {
      setNotice('임시저장하지 못했습니다. 다시 시도해 주세요.');
    }
  }

  function handleAnalyze(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (analysisPending.current) return;
    const nextErrors: FieldErrors = {};
    if (!mockConnectedTeachers.some((teacher) => teacher.value === draft.teacherId)) {
      nextErrors.teacherId = '연결된 선생님을 선택해 주세요.';
    }
    if (!draft.title.trim()) nextErrors.title = '문의 제목을 입력해 주세요.';
    if (!draft.body.trim()) nextErrors.body = '문의 내용을 입력해 주세요.';
    if (draft.body.length > MESSAGE_MAX_LENGTH) nextErrors.body = `문의 내용은 ${MESSAGE_MAX_LENGTH}자 이내로 작성해 주세요.`;
    setErrors(nextErrors);
    const firstInvalid = (['teacherId', 'title', 'body'] as const).find((field) => nextErrors[field]);
    if (firstInvalid) {
      document.getElementById(`parent-message-${firstInvalid}`)?.focus();
      return;
    }
    if (checkPersonalInfo(draft.body).status === 'failed') {
      setMaskingFailed(true);
      return;
    }
    if (draft.review) {
      try {
        saveMessageDraft(userId, { ...draft, status: 'PARENT_REVIEW' });
        navigate(`/parent/messages/${draft.messageId}/review`);
      } catch {
        setNotice('작성한 내용을 저장하지 못했습니다. 다시 시도해 주세요.');
      }
      return;
    }
    if (!navigator.onLine) {
      setNotice('인터넷 연결을 확인한 후 다시 시도해 주세요.');
      return;
    }
    try {
      const nextDraft: MessageDraft = {
        ...draft, title: draft.title.trim(), body: draft.body.trim(), status: 'DRAFT',
      };
      saveMessageDraft(userId, nextDraft);
      analysisPending.current = true;
      setMaskingFailed(false);
      setNotice(null);
      setDraft(nextDraft);
      setIsAnalyzing(true);
    } catch {
      setNotice('작성한 내용을 저장하지 못했습니다. 다시 시도해 주세요.');
    }
  }

  function handleBack() {
    if (isAnalyzing) {
      analysisPending.current = false;
      setIsAnalyzing(false);
      window.requestAnimationFrame(() => document.getElementById('parent-message-body')?.focus());
    } else {
      navigate(threadId ? `/parent/messages/${threadId}` : '/parent/messages');
    }
  }

  if (initial.unavailable) return <>
    <ParentMessageHeader title={threadId ? '추가 문의하기' : '새 문의 작성'} />
    <main className="layout-main"><EmptyState title="작성할 문의를 찾을 수 없습니다."
      action={<Button onClick={() => navigate('/parent/messages')}>문의 내역</Button>} /></main>
  </>;

  return (
    <>
      <ParentMessageHeader title={threadId ? '추가 문의하기' : '새 문의 작성'}
        breadcrumbLabel={threadId ? '추가 문의하기' : '새 문의 작성'} showBack={Boolean(threadId) || isAnalyzing}
        backLabel={isAnalyzing ? '문의 작성으로 돌아가기' : '문의 내역으로 돌아가기'} onBack={handleBack} />

      <main className="layout-main parent-write-main" aria-busy={isAnalyzing}>
        {isAnalyzing ? (
          <section className="parent-analysis" aria-label="메시지 분석 중">
            <div className="parent-analysis-progress" role="status" aria-live="polite">
              <img alt="" aria-hidden="true" className="parent-analysis-illustration" src={analysisIllustration} />
              <div aria-hidden="true" className="parent-analysis-dots"><span /><span /><span /></div>
              <p className="parent-analysis-title" ref={loadingTitle} tabIndex={-1}>AI가 메시지를 분석하고 있어요.</p>
              <p className="parent-analysis-description">잠시만 기다려 주세요.</p>
            </div>
            <div className="parent-analysis-privacy">
              <LockKeyhole aria-hidden="true" size={24} />
              <p>전화번호·이메일을 가린 문장으로 AI 분석을 진행하고 있습니다. 분석이 끝나면 전송할 내용을 직접 확인할 수 있습니다.</p>
            </div>
          </section>
        ) : (
          <>
            <section className="parent-write-notice" aria-labelledby="parent-write-notice-title">
              <div className="parent-write-notice-heading">
                <h2 id="parent-write-notice-title">문의 전 확인해 주세요</h2>
              </div>
              <ul>
                <li>작성한 문의는 전송 후 수정하거나 삭제할 수 없습니다. 전송하기 전에 제목과 내용을 다시 한번 확인해 주세요.</li>
                <li>서로를 배려하는 표현으로 문의를 작성해 주세요.<br />폭언, 욕설 등 부적절한 표현은 관련 법령에 따라 문제가 될 수 있습니다.</li>
                <li>개인정보나 계좌번호·카드번호·비밀번호 등 금융정보를 요구받으면 금융사기일 수 있으니 주의해 주세요.</li>
              </ul>
            </section>

            <form className="parent-write-form" noValidate onSubmit={handleAnalyze}>
              {threadId ? <TextField containerClassName="parent-write-field" error={errors.teacherId} id="parent-message-teacherId"
                label="문의 대상" readOnly value={initial.thread?.teacherName ?? ''} title="기존 문의의 선생님께 이어서 전달됩니다." trailingIcon={<ChevronDown size={20} />} /> : <Select containerClassName="parent-write-field" error={errors.teacherId}
                helperText={mockConnectedTeachers.length === 0 ? '연결된 선생님이 없습니다. 학교에 교사 연결을 요청해 주세요.' : undefined}
                id="parent-message-teacherId" label="문의 대상" name="teacherId"
                onChange={(event) => updateField('teacherId', event.target.value)}
                options={mockConnectedTeachers} placeholder="선생님을 선택해 주세요." required value={draft.teacherId} />}
              <TextField containerClassName="parent-write-field" error={errors.title}
                id="parent-message-title" label="문의 제목" name="title"
                onChange={(event) => updateField('title', event.target.value)}
                placeholder="문의 제목을 입력해 주세요." readOnly={Boolean(threadId)} required value={draft.title} />
              <TextareaField containerClassName="parent-write-field parent-write-body" error={errors.body}
                id="parent-message-body" label="문의 내용" maxLength={MESSAGE_MAX_LENGTH} name="body"
                onChange={(event) => updateField('body', event.target.value)}
                placeholder={threadId ? '추가로 문의할 내용을 작성해 주세요.' : '선생님께 전달할 문의 내용을 작성해 주세요.'} required rows={10} value={draft.body} />
              {maskingFailed || draft.body.trim() || draft.title.trim() ? (
                <PrivacyMaskingNotice
                  onRetry={() => handleAnalyze()}
                  result={maskingFailed ? { status: 'failed', text: null, count: null }
                    : { status: 'ready', ...maskContactInfo(`제목: ${draft.title}\n\n내용: ${draft.body}`) }}
                />
              ) : null}
              <div className="parent-write-actions">
                <Button className="parent-write-save" leftIcon={<Save size={22} />} onClick={handleSaveDraft} size="lg" variant="outline">임시저장</Button>
                <Button className="parent-write-analyze" disabled={mockConnectedTeachers.length === 0 || maskingFailed}
                  leftIcon={<Send size={22} />} size="lg" type="submit">AI 분석 시작</Button>
              </div>
            </form>
          </>
        )}
      </main>
      {notice ? <Toast message={notice} onClose={dismissNotice} /> : null}
    </>
  );
}
