import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ChevronDown, LockKeyhole, Save, Send } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import analysisIllustration from '../../shared/assets/parent/message-analysis.svg';
import { getApiErrorMessage, isApiError } from '../../shared/api';
import { Button, EmptyState, Select, TextareaField, TextField, Toast } from '../../shared/components/ui';
import { COMPLAINT_TITLE_MAX_LENGTH, parentMessageApiMode } from './api/parentComplaintApi';
import {
  findSentMessage, mockConnectedTeachers, readMessageDraft, readMessageDrafts, saveMessageDraft,
  type MessageDraft, type ServerComplaintDraft,
} from './messageDraft';
import { ParentMessageHeader } from './ParentMessageHeader';
import { analyzeParentMessage } from './parentMessageApi';
import { createMessageReview, MESSAGE_MAX_LENGTH, type ParentMessageAnalysis } from './parentMessageTypes';
import { getDraftPath } from './conversation';
import { analyzeServerDraft, createServerDraft, type ServerDraftTarget } from './serverComplaint';
import { useServerRecipients } from './useServerRecipients';
import { checkPersonalInfo, maskContactInfo, MaskingError, PrivacyMaskingNotice } from '../pii';
import './ParentMessageComposer.css';

type FieldName = 'studentId' | 'teacherId' | 'title' | 'body';
type FieldErrors = Partial<Record<FieldName, string>>;

const ANALYSIS_FAILED_MESSAGE = 'AI 분석을 완료하지 못했어요. 작성한 내용은 유지됩니다. 잠시 후 다시 시도해 주세요.';
const CHILD_LINK_MESSAGE = '선택한 자녀와 계정의 연결을 확인하지 못했어요. 학교에 학생 연결을 요청해 주세요.';

// Server draft creations by `${userId}:${messageId}`. Module-level so a composer opened again after leaving the
// page waits for a creation that is still running instead of sending a second POST /complaints.
const pendingCreations = new Map<string, Promise<ServerComplaintDraft>>();

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
  // Follow-ups stay on the local flow; the message-draft API is not connected yet.
  const isServer = parentMessageApiMode === 'http' && !threadId;
  const [draft, setDraft] = useState<MessageDraft>(() => {
    const saved = initial.saved;
    // A review made without a server draft (in mock mode) cannot be submitted to the server, so it is analyzed again.
    if (saved && isServer && saved.review && !saved.server) return { ...saved, review: undefined, status: 'DRAFT' };
    return saved ?? {
      messageId: crypto.randomUUID(),
      teacherId: initial.thread?.teacherId ?? (isServer ? '' : mockConnectedTeachers[0]?.value ?? ''),
      title: initial.thread?.title ?? '', body: '', status: 'DRAFT', threadId,
    };
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [maskingFailed, setMaskingFailed] = useState(false);
  const [notice, setNotice] = useState<string | null>(location.state?.draftSaved ? '문의가 임시저장되었습니다.' : null);
  const analysisPending = useRef(false);
  const analysisTarget = useRef<ServerDraftTarget | null>(null);
  const creationKey = `${userId}:${draft.messageId}`;
  const [isCreatingServerDraft, setIsCreatingServerDraft] = useState(() => pendingCreations.has(creationKey));
  const loadingTitle = useRef<HTMLParagraphElement>(null);
  const dismissNotice = useCallback(() => setNotice(null), []);
  // Title, child, and teacher cannot change once the server draft exists (PATCH only takes the content),
  // nor while its creation is still running after the parent left the analysis.
  const serverLocked = isServer && (Boolean(draft.server) || isCreatingServerDraft);
  const studentId = draft.server?.studentId ?? draft.studentId;
  const { children, recipients } = useServerRecipients(isServer && !draft.server, studentId);
  const retryRecipients = recipients.retry;
  const teacherOptions = !isServer ? mockConnectedTeachers
    : draft.server ? [{ value: String(draft.server.teacherId), label: `${draft.server.teacherName} 선생님` }]
      : (recipients.data ?? []).map((teacher) => ({ value: String(teacher.teacherId), label: teacher.label }));
  const childOptions = (children.data ?? []).map((child) => ({ value: String(child.studentId), label: child.studentName }));
  if (draft.server && !childOptions.some((option) => option.value === String(draft.server?.studentId))) {
    childOptions.unshift({ value: String(draft.server.studentId), label: '선택한 자녀' });
  }

  // Preselect the only or first child, then the homeroom teacher (the server lists them first).
  const firstChildId = children.data?.[0]?.studentId;
  const firstTeacherId = recipients.data?.[0]?.teacherId;
  const teacherListed = recipients.data?.some((teacher) => String(teacher.teacherId) === draft.teacherId) ?? false;
  useEffect(() => {
    if (!isServer || serverLocked || isAnalyzing) return;
    if (!draft.studentId && firstChildId) setDraft((previous) => ({ ...previous, studentId: firstChildId }));
  }, [draft.studentId, firstChildId, isAnalyzing, isServer, serverLocked]);
  useEffect(() => {
    if (!isServer || serverLocked || isAnalyzing || recipients.isLoading || !recipients.data || teacherListed) return;
    setDraft((previous) => ({ ...previous, teacherId: firstTeacherId ? String(firstTeacherId) : '' }));
  }, [firstTeacherId, isAnalyzing, isServer, recipients.data, recipients.isLoading, serverLocked, teacherListed]);

  // Opened again while an earlier composer's creation is still running: link its result when it arrives.
  useEffect(() => {
    const pending = pendingCreations.get(creationKey);
    if (!pending || draft.server) return;
    let active = true;
    pending.then((server) => {
      if (active) setDraft((previous) => previous.server ? previous : { ...previous, server });
    }, () => undefined).finally(() => {
      if (active) setIsCreatingServerDraft(false);
    });
    return () => {
      active = false;
    };
  }, [creationKey, draft.server]);

  useEffect(() => {
    if (!isAnalyzing) return;
    loadingTitle.current?.focus();
    window.scrollTo({ top: 0, behavior: 'instant' });

    const controller = new AbortController();
    let latestServer = draft.server;
    let creationFailed = false;
    // Keeps the server draft in the form when the analysis stops early, so a retry reuses it.
    const keepServerDraft = () => {
      if (latestServer === draft.server) return;
      setDraft((previous) => previous.server === latestServer ? previous : { ...previous, server: latestServer });
    };
    const stopAnalyzing = () => {
      analysisPending.current = false;
      setIsAnalyzing(false);
      keepServerDraft();
    };
    const persistServer = (server: ServerComplaintDraft) => {
      latestServer = server;
      saveMessageDraft(userId, { ...draft, server });
    };
    const analyze = async () => {
      let analysis: ParentMessageAnalysis;
      try {
        if (isServer) {
          const target = analysisTarget.current;
          if (!target) throw new Error(ANALYSIS_FAILED_MESSAGE);
          let current = draft;
          if (!current.server) {
            // Leaving the analysis does not cancel the creation; a new attempt waits for the same one.
            const creation = pendingCreations.get(creationKey) ?? createServerDraft(draft, target).then((server) => {
              try {
                // Merged into the stored draft, which the parent may have edited after leaving.
                saveMessageDraft(userId, { ...(readMessageDraft(userId, draft.messageId) ?? draft), server });
              } catch {
                // The form state below still keeps the link for this session.
              }
              return server;
            }).finally(() => {
              pendingCreations.delete(creationKey);
              setIsCreatingServerDraft(false);
            });
            pendingCreations.set(creationKey, creation);
            setIsCreatingServerDraft(true);
            try {
              latestServer = await creation;
            } catch (failure) {
              creationFailed = true;
              throw failure;
            }
            current = { ...draft, server: latestServer };
            controller.signal.throwIfAborted();
          }
          analysis = (await analyzeServerDraft(current, target, persistServer, controller.signal)).analysis;
        } else {
          analysis = await analyzeParentMessage(draft, controller.signal);
        }
      } catch (failure) {
        if (controller.signal.aborted) {
          keepServerDraft();
          return;
        }
        if (failure instanceof MaskingError) {
          stopAnalyzing();
          setMaskingFailed(true);
          return;
        }
        if (!isServer) {
          analysis = { status: 'failed', revisedText: null, risks: [], meaningWarning: null };
        } else {
          // Without a stored analysis the server refuses to submit, so the parent stays on the form to retry.
          if (isApiError(failure) && failure.code === 'COMPLAINT_NOT_FOUND') {
            // The stored link is dropped too, so reopening the draft does not retry the missing complaint.
            latestServer = undefined;
            try {
              saveMessageDraft(userId, { ...draft, server: undefined, review: undefined, status: 'DRAFT' });
            } catch {
              // The form state still drops the link for this session.
            }
          }
          stopAnalyzing();
          if (isApiError(failure) && failure.code === 'INVALID_COMPLAINT_RECIPIENT') {
            setErrors({ teacherId: getApiErrorMessage(failure) });
            retryRecipients();
          } else if (creationFailed && isApiError(failure) && failure.code === 'INVALID_REQUEST') {
            // POST /complaints answers the generic INVALID_REQUEST when the parent is not linked to the student.
            setErrors({ studentId: CHILD_LINK_MESSAGE });
            window.requestAnimationFrame(() => document.getElementById('parent-message-studentId')?.focus());
          } else {
            setNotice(getApiErrorMessage(failure, ANALYSIS_FAILED_MESSAGE));
          }
          return;
        }
      }
      if (controller.signal.aborted) {
        keepServerDraft();
        return;
      }
      try {
        saveMessageDraft(userId, { ...draft, server: latestServer, status: 'PARENT_REVIEW', review: createMessageReview(analysis) });
        navigate(`/parent/messages/${draft.messageId}/review`);
      } catch {
        stopAnalyzing();
        setNotice('작성한 내용을 저장하지 못했습니다. 다시 시도해 주세요.');
      }
    };
    void analyze();

    return () => controller.abort();
  }, [creationKey, draft, isAnalyzing, isServer, navigate, retryRecipients, userId]);

  function updateField(field: Exclude<FieldName, 'studentId'>, value: string) {
    setDraft((previous) => ({ ...previous, [field]: value, status: 'DRAFT', review: undefined }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
    setMaskingFailed(false);
  }

  function selectChild(value: string) {
    setDraft((previous) => ({ ...previous, studentId: Number(value) || undefined, teacherId: '', status: 'DRAFT', review: undefined }));
    setErrors((previous) => ({ ...previous, studentId: undefined, teacherId: undefined }));
  }

  // The selected server teacher's name, so the history lists the draft under it before a server draft exists.
  function withTeacherName(next: MessageDraft): MessageDraft {
    if (!isServer || next.server) return next;
    const teacherName = recipients.data?.find((teacher) => String(teacher.teacherId) === next.teacherId)?.teacherName;
    return { ...next, teacherName };
  }

  function handleSaveDraft() {
    if (!draft.title.trim() && !draft.body.trim()) {
      setNotice('임시저장할 제목이나 내용을 입력해 주세요.');
      return;
    }
    try {
      saveMessageDraft(userId, withTeacherName({ ...draft, status: 'DRAFT' }));
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
    if (isServer && !studentId) nextErrors.studentId = '문의할 자녀를 선택해 주세요.';
    const teacher = teacherOptions.find((option) => option.value === draft.teacherId);
    if (!teacher) {
      nextErrors.teacherId = '연결된 선생님을 선택해 주세요.';
    }
    if (!draft.title.trim()) nextErrors.title = '문의 제목을 입력해 주세요.';
    if (draft.title.trim().length > COMPLAINT_TITLE_MAX_LENGTH) nextErrors.title = `문의 제목은 ${COMPLAINT_TITLE_MAX_LENGTH}자 이내로 작성해 주세요.`;
    if (!draft.body.trim()) nextErrors.body = '문의 내용을 입력해 주세요.';
    if (draft.body.length > MESSAGE_MAX_LENGTH) nextErrors.body = `문의 내용은 ${MESSAGE_MAX_LENGTH}자 이내로 작성해 주세요.`;
    setErrors(nextErrors);
    const firstInvalid = (['studentId', 'teacherId', 'title', 'body'] as const).find((field) => nextErrors[field]);
    if (firstInvalid) {
      document.getElementById(`parent-message-${firstInvalid}`)?.focus();
      return;
    }
    if (checkPersonalInfo(draft.body).status === 'failed') {
      setMaskingFailed(true);
      return;
    }
    if (draft.review && (!isServer || draft.server)) {
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
      const nextDraft = withTeacherName({
        ...draft, title: draft.title.trim(), body: draft.body.trim(), status: 'DRAFT',
      });
      saveMessageDraft(userId, nextDraft);
      const recipient = recipients.data?.find((item) => String(item.teacherId) === draft.teacherId);
      analysisTarget.current = draft.server ?? (studentId && recipient
        ? { studentId, teacherId: recipient.teacherId, teacherName: recipient.teacherName } : null);
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

  // A follow-up on an inquiry submitted to the server needs the message-draft API, which is not connected yet.
  const serverFollowUp = parentMessageApiMode === 'http' && initial.thread?.serverComplaintId !== undefined;
  if (initial.unavailable || serverFollowUp) return <>
    <ParentMessageHeader title={threadId ? '추가 문의하기' : '새 문의 작성'} />
    <main className="layout-main"><EmptyState
      title={serverFollowUp ? '추가 문의는 아직 준비 중입니다.' : '작성할 문의를 찾을 수 없습니다.'}
      action={<Button onClick={() => navigate('/parent/messages')}>문의 내역</Button>} /></main>
  </>;

  const childHelper = serverLocked ? 'AI 분석을 시작한 문의는 자녀를 바꿀 수 없습니다.'
    : children.isLoading ? '자녀 정보를 불러오고 있어요.'
      : children.error ? <>{getApiErrorMessage(children.error, '자녀 정보를 불러오지 못했어요.')} <button className="parent-write-retry" onClick={children.retry} type="button">다시 시도</button></>
        : childOptions.length === 0 ? '확인된 자녀 정보가 없습니다. 학교에 학생 연결을 요청해 주세요.' : undefined;
  const teacherHelper = !isServer ? (teacherOptions.length === 0 ? '연결된 선생님이 없습니다. 학교에 교사 연결을 요청해 주세요.' : undefined)
    : serverLocked ? 'AI 분석을 시작한 문의는 문의 대상을 바꿀 수 없습니다.'
      : !studentId ? undefined
        : recipients.isLoading ? '선생님 목록을 불러오고 있어요.'
          : recipients.error ? <>{getApiErrorMessage(recipients.error, '선생님 목록을 불러오지 못했어요.')} <button className="parent-write-retry" onClick={recipients.retry} type="button">다시 시도</button></>
            : teacherOptions.length === 0 ? '연결된 선생님이 없습니다. 학교에 교사 연결을 요청해 주세요.' : undefined;

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
              <p>전화번호·이메일·주민등록번호를 가린 문장으로 AI 분석을 진행하고 있습니다. 분석이 끝나면 전송할 내용을 직접 확인할 수 있습니다.</p>
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
              {isServer ? <Select containerClassName="parent-write-field" disabled={serverLocked || childOptions.length === 0}
                error={errors.studentId} helperText={childHelper} id="parent-message-studentId" label="자녀" name="studentId"
                onChange={(event) => selectChild(event.target.value)} options={childOptions}
                placeholder="자녀를 선택해 주세요." required value={studentId ? String(studentId) : ''} /> : null}
              {threadId ? <TextField containerClassName="parent-write-field" error={errors.teacherId} id="parent-message-teacherId"
                label="문의 대상" readOnly value={initial.thread?.teacherName ?? ''} title="기존 문의의 선생님께 이어서 전달됩니다." trailingIcon={<ChevronDown size={20} />} /> : <Select containerClassName="parent-write-field" error={errors.teacherId}
                disabled={serverLocked || (isServer && teacherOptions.length === 0)} helperText={teacherHelper}
                id="parent-message-teacherId" label="문의 대상" name="teacherId"
                onChange={(event) => updateField('teacherId', event.target.value)}
                options={teacherOptions} placeholder="선생님을 선택해 주세요." required value={draft.teacherId} />}
              <TextField containerClassName="parent-write-field" error={errors.title}
                helperText={serverLocked ? 'AI 분석을 시작한 문의는 제목을 바꿀 수 없습니다.' : undefined}
                id="parent-message-title" label="문의 제목" maxLength={COMPLAINT_TITLE_MAX_LENGTH} name="title"
                onChange={(event) => updateField('title', event.target.value)}
                placeholder="문의 제목을 입력해 주세요." readOnly={Boolean(threadId) || serverLocked} required value={draft.title} />
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
                <Button className="parent-write-analyze" disabled={teacherOptions.length === 0 || maskingFailed}
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
