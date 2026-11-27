import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ChevronDown, ChevronUp, LockKeyhole, Save, Send, Sparkles } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import analysisIllustration from '../../shared/assets/parent/message-analysis.svg';
import { getApiErrorMessage, isApiError, isRiskAnalysisSafetyError } from '../../shared/api';
import { Accordion, Button, EmptyState, InformationTooltip, Select, TextareaField, TextField, Toast } from '../../shared/components/ui';
import { useAuth } from '../auth';
import { COMPLAINT_TITLE_MAX_LENGTH, parentComplaintApi, parentMessageApiMode } from './api/parentComplaintApi';
import {
  findSentMessage, getDraftStudentName, getParentMessageNames, mockConnectedTeachers, readMessageDraft, readMessageDrafts, saveMessageDraft,
  type MessageDraft, type ServerComplaintDraft,
} from './messageDraft';
import { ParentMessageHeader } from './ParentMessageHeader';
import { analyzeParentMessage } from './parentMessageApi';
import { createMessageReview, MESSAGE_MAX_LENGTH, type ParentMessageAnalysis } from './parentMessageTypes';
import { getDraftPath } from './conversation';
import { analyzeServerDraft, createServerDraft, toFollowUpServerDraft, type ServerDraftTarget } from './serverComplaint';
import { useServerRecipients } from './useServerRecipients';
import { checkPersonalInfo, maskContactInfo, MaskingError, PrivacyMaskingNotice } from '../pii';
import { maskDraftPreview } from '../pii/masking';
import './ParentMessageComposer.css';

type FieldName = 'studentId' | 'teacherId' | 'title' | 'body';
type FieldErrors = Partial<Record<FieldName, string>>;

const ANALYSIS_FAILED_MESSAGE = 'AI 분석을 완료하지 못했어요. 작성한 내용은 유지됩니다. 잠시 후 다시 시도해 주세요.';
const CHILD_LINK_MESSAGE = '선택한 자녀와 계정의 연결을 확인하지 못했어요. 학교에 학생 연결을 요청해 주세요.';

// Server draft creations by `${userId}:${messageId}`. Module-level so a composer opened again after leaving the
// page waits for a creation that is still running instead of sending a second POST /complaints.
const pendingCreations = new Map<string, Promise<ServerComplaintDraft>>();

export function ParentMessageComposer({ userId, threadId, draftId, fresh = false, embedded = false, blocked = false, onCollapse }: {
  userId: number; threadId?: string; draftId?: string; fresh?: boolean;
  embedded?: boolean; blocked?: boolean; onCollapse?: () => void;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [initial] = useState(() => {
    try {
      const thread = threadId ? findSentMessage(userId, threadId) : null;
      const saved = draftId ? readMessageDraft(userId, draftId) : fresh ? null : threadId
        ? readMessageDrafts(userId).find((item) => item.threadId === threadId) : readMessageDraft(userId);
      const matching = saved && saved.threadId === threadId ? saved : null;
      // Browser Back can restore an inline draft ID that was removed after sending.
      // Recover only this user's existing thread; standalone draft URLs stay strict.
      const recoverInline = embedded && thread && draftId && !matching;
      const restored = recoverInline ? readMessageDrafts(userId).find((item) => item.threadId === threadId) : matching;
      return { thread, saved: restored, unavailable: Boolean((threadId && !thread) || (draftId && !matching && !recoverInline)) };
    } catch {
      return { thread: null, saved: null, unavailable: true };
    }
  });
  const isServer = parentMessageApiMode === 'http';
  const isServerFollowUp = isServer && Boolean(threadId);
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
  const [savedBody, setSavedBody] = useState<string | null>(initial.saved?.body ?? null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [maskingFailed, setMaskingFailed] = useState(false);
  const [canReloadServerDraft, setCanReloadServerDraft] = useState(false);
  const [notice, setNotice] = useState<string | null>(location.state?.draftSaved ? '문의가 임시저장되었습니다.' : null);
  const analysisPending = useRef(false);
  const draftEdits = useRef(0);
  const reloadAttempt = useRef(0);
  useEffect(() => () => { reloadAttempt.current += 1; }, []);
  const analysisInput = useRef<{ target: ServerDraftTarget | null; names: ReturnType<typeof getParentMessageNames> }>({ target: null, names: [] });
  const creationKey = `${userId}:${draft.messageId}`;
  const [isCreatingServerDraft, setIsCreatingServerDraft] = useState(() => pendingCreations.has(creationKey));
  const loadingTitle = useRef<HTMLParagraphElement>(null);
  const dismissNotice = useCallback(() => setNotice(null), []);
  useEffect(() => {
    if (embedded) document.getElementById('parent-message-body')?.focus();
  }, [embedded]);
  // Title, child, and teacher cannot change once the server draft exists (PATCH only takes the content),
  // nor while its creation is still running after the parent left the analysis.
  const serverLocked = isServer && (isServerFollowUp || Boolean(draft.server) || isCreatingServerDraft);
  const studentId = draft.server?.studentId ?? draft.studentId;
  const { children, recipients } = useServerRecipients(isServer && (!isServerFollowUp || studentId !== undefined), studentId, !isServerFollowUp && !draft.server);
  const retryRecipients = recipients.retry;
  const recipient = recipients.data?.find((item) => String(item.teacherId) === draft.teacherId);
  const teacherName = draft.server?.teacherName ?? initial.thread?.teacherName ?? recipient?.teacherName ?? draft.teacherName;
  const studentName = children.data?.find((child) => child.studentId === studentId)?.studentName.trim() || getDraftStudentName(draft, user);
  const needsStudentName = isServer && studentId !== undefined && !studentName;
  const names = getParentMessageNames({ ...draft, studentName, teacherName }, user);
  const teacherOptions = isServerFollowUp && initial.thread ? [{ value: initial.thread.teacherId, label: initial.thread.teacherName }]
    : !isServer ? mockConnectedTeachers
    : draft.server ? [{ value: String(draft.server.teacherId), label: `${draft.server.teacherName} 선생님` }]
      : (recipients.data ?? []).map((teacher) => ({ value: String(teacher.teacherId), label: teacher.label }));
  const childOptions = (children.data ?? []).map((child) => ({ value: String(child.studentId), label: child.studentName }));
  if (draft.server?.studentId && !childOptions.some((option) => option.value === String(draft.server?.studentId))) {
    childOptions.unshift({ value: String(draft.server.studentId), label: children.isLoading ? '자녀 정보를 불러오는 중…' : '자녀 정보 확인 필요' });
  }

  // Recover a saved server follow-up when there is no browser draft (e.g. after changing devices).
  useEffect(() => {
    const thread = initial.thread;
    if (!isServerFollowUp || initial.saved || !thread?.serverComplaintId) return;
    const controller = new AbortController();
    void parentComplaintApi.getFollowUpDraft(thread.serverComplaintId, controller.signal).then((saved) => {
      if (!saved || controller.signal.aborted) return;
      setSavedBody(saved.content);
      setDraft((previous) => previous.body || previous.server ? previous : {
        ...previous, body: saved.content,
        server: toFollowUpServerDraft(previous, { teacherId: Number(thread.teacherId), teacherName: thread.teacherName }, saved),
      });
    }).catch((failure: unknown) => {
      if (!controller.signal.aborted) setNotice(getApiErrorMessage(failure, '추가 문의 초안을 불러오지 못했습니다.'));
    });
    return () => controller.abort();
  }, [initial.saved, initial.thread, isServerFollowUp]);

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
    if (blocked) {
      analysisPending.current = false;
      setIsAnalyzing(false);
      return;
    }
    loadingTitle.current?.focus();
    if (!embedded) window.scrollTo({ top: 0, behavior: 'instant' });

    const controller = new AbortController();
    const { target, names } = analysisInput.current;
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
          if (!target) throw new Error(ANALYSIS_FAILED_MESSAGE);
          let current = draft;
          if (!current.server) {
            // Leaving the analysis does not cancel the creation; a new attempt waits for the same one.
            const creation = pendingCreations.get(creationKey) ?? createServerDraft(draft, target, names).then((server) => {
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
          analysis = (await analyzeServerDraft(current, target, persistServer, controller.signal, names)).analysis;
        } else {
          analysis = await analyzeParentMessage(draft, controller.signal, names);
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
          if (isRiskAnalysisSafetyError(failure)) {
            setErrors({ body: getApiErrorMessage(failure) });
          } else if (isApiError(failure) && failure.code === 'INVALID_COMPLAINT_RECIPIENT') {
            setErrors({ teacherId: getApiErrorMessage(failure) });
            retryRecipients();
          } else if (creationFailed && isApiError(failure) && failure.code === 'INVALID_REQUEST') {
            // POST /complaints answers the generic INVALID_REQUEST when the parent is not linked to the student.
            setErrors({ studentId: CHILD_LINK_MESSAGE });
            window.requestAnimationFrame(() => document.getElementById('parent-message-studentId')?.focus());
          } else {
            setCanReloadServerDraft(isServerFollowUp && isApiError(failure) && failure.code === 'PARENT_DRAFT_CONFLICT');
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
        navigate(`/parent/messages/${draft.messageId}/review`, { state: { inlineFollowUp: embedded } });
      } catch {
        stopAnalyzing();
        setNotice('작성한 내용을 저장하지 못했습니다. 다시 시도해 주세요.');
      }
    };
    void analyze();

    return () => controller.abort();
  }, [blocked, creationKey, draft, embedded, isAnalyzing, isServer, isServerFollowUp, navigate, retryRecipients, userId]);

  async function reloadServerFollowUp() {
    const thread = initial.thread;
    if (!thread?.serverComplaintId) return;
    const attempt = ++reloadAttempt.current;
    const edits = draftEdits.current;
    try {
      const saved = await parentComplaintApi.getFollowUpDraft(thread.serverComplaintId);
      if (attempt !== reloadAttempt.current) return;
      if (edits !== draftEdits.current || analysisPending.current) {
        setNotice('불러오는 동안 내용이 변경되어 현재 입력한 내용을 유지했습니다.');
        return;
      }
      setDraft((previous) => ({
        ...previous, body: saved?.content ?? previous.body, review: undefined, status: 'DRAFT',
        server: saved ? toFollowUpServerDraft(previous, { teacherId: Number(thread.teacherId), teacherName: thread.teacherName }, saved) : undefined,
      }));
      setCanReloadServerDraft(false);
      if (saved) setSavedBody(saved.content);
      setNotice(saved ? '서버 초안을 불러왔습니다.' : '저장된 서버 초안이 없습니다. 현재 내용으로 다시 분석해 주세요.');
    } catch (failure) {
      if (attempt === reloadAttempt.current) setNotice(getApiErrorMessage(failure, '서버 초안을 불러오지 못했습니다.'));
    }
  }

  function updateField(field: Exclude<FieldName, 'studentId'>, value: string) {
    draftEdits.current += 1;
    setSaveFailed(false);
    setDraft((previous) => ({
      ...previous, [field]: value, status: 'DRAFT', review: undefined,
      ...(field === 'teacherId' ? { teacherName: undefined } : {}),
    }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
    setMaskingFailed(false);
  }

  function selectChild(value: string) {
    setDraft((previous) => ({
      ...previous, studentId: Number(value) || undefined, studentName: undefined,
      teacherId: '', teacherName: undefined, status: 'DRAFT', review: undefined,
    }));
    setErrors((previous) => ({ ...previous, studentId: undefined, teacherId: undefined }));
  }

  function withRecipientNames(next: MessageDraft): MessageDraft {
    return isServer ? { ...next, studentName, teacherName } : next;
  }

  function handleSaveDraft() {
    if (needsStudentName) return;
    if (!draft.title.trim() && !draft.body.trim()) {
      setNotice('임시저장할 제목이나 내용을 입력해 주세요.');
      return;
    }
    try {
      saveMessageDraft(userId, withRecipientNames({ ...draft, status: 'DRAFT' }));
      setSavedBody(draft.body);
      setSaveFailed(false);
      setNotice('문의가 임시저장되었습니다.');
      if (fresh) navigate(getDraftPath(draft), { replace: true, state: { draftSaved: true } });
    } catch {
      setSaveFailed(true);
      setNotice('임시저장하지 못했습니다. 다시 시도해 주세요.');
    }
  }

  function handleCollapse() {
    if (needsStudentName) return;
    try {
      // Preserve the exact draft, including any existing analysis and server version.
      // Closing before the initial server read finishes must not hide that server draft
      // behind a new empty browser draft on the next open.
      if (initial.saved || draftEdits.current > 0 || draft.server || draft.body) {
        saveMessageDraft(userId, withRecipientNames(draft));
      }
      onCollapse?.();
    } catch {
      setSaveFailed(true);
      setNotice('작성한 내용을 저장하지 못했습니다. 입력창을 유지합니다. 다시 시도해 주세요.');
    }
  }

  function handleAnalyze(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (analysisPending.current || blocked || needsStudentName) return;
    const nextErrors: FieldErrors = {};
    if (isServer && !isServerFollowUp && !studentId) nextErrors.studentId = '문의할 자녀를 선택해 주세요.';
    const teacher = teacherOptions.find((option) => option.value === draft.teacherId);
    if (!teacher) {
      nextErrors.teacherId = '연결된 선생님을 선택해 주세요.';
    }
    if (!draft.title.trim()) nextErrors.title = '문의 제목을 입력해 주세요.';
    if (draft.title.trim().length > COMPLAINT_TITLE_MAX_LENGTH) nextErrors.title = `문의 제목은 ${COMPLAINT_TITLE_MAX_LENGTH}자 이내로 작성해 주세요.`;
    else if (!draft.server && !threadId && maskContactInfo(draft.title.trim(), names).text.length > COMPLAINT_TITLE_MAX_LENGTH) {
      nextErrors.title = `마스킹한 제목이 ${COMPLAINT_TITLE_MAX_LENGTH}자 이내가 되도록 줄여 주세요.`;
    }
    if (!draft.body.trim()) nextErrors.body = '문의 내용을 입력해 주세요.';
    if (draft.body.length > MESSAGE_MAX_LENGTH) nextErrors.body = `문의 내용은 ${MESSAGE_MAX_LENGTH}자 이내로 작성해 주세요.`;
    else if (maskContactInfo(draft.body.trim(), names).text.length > MESSAGE_MAX_LENGTH) {
      nextErrors.body = `마스킹한 내용이 ${MESSAGE_MAX_LENGTH}자 이내가 되도록 줄여 주세요.`;
    }
    setErrors(nextErrors);
    const firstInvalid = (['studentId', 'teacherId', 'title', 'body'] as const).find((field) => nextErrors[field]);
    if (firstInvalid) {
      document.getElementById(`parent-message-${firstInvalid}`)?.focus();
      return;
    }
    if (checkPersonalInfo(draft.body, names).status === 'failed') {
      setMaskingFailed(true);
      return;
    }
    if (draft.review && (!isServer || draft.server)) {
      try {
        saveMessageDraft(userId, withRecipientNames({ ...draft, status: 'PARENT_REVIEW' }));
        navigate(`/parent/messages/${draft.messageId}/review`, { state: { inlineFollowUp: embedded } });
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
      const nextDraft = withRecipientNames({
        ...draft, title: threadId ? draft.title : draft.title.trim(), body: draft.body.trim(), status: 'DRAFT',
      });
      saveMessageDraft(userId, nextDraft);
      setSavedBody(nextDraft.body);
      setSaveFailed(false);
      const target = draft.server ?? (isServerFollowUp && initial.thread?.serverComplaintId
        ? { complaintId: initial.thread.serverComplaintId, teacherId: Number(initial.thread.teacherId), teacherName: initial.thread.teacherName }
        : studentId && recipient
        ? { studentId, teacherId: recipient.teacherId, teacherName: recipient.teacherName } : null);
      analysisInput.current = { target, names };
      analysisPending.current = true;
      setMaskingFailed(false);
      setNotice(null);
      setDraft(nextDraft);
      setIsAnalyzing(true);
      if (!threadId && !draftId) {
        // Preserve the mounted analysis while making reload and Browser Back resume this draft.
        navigate(getDraftPath(nextDraft), {
          replace: true, state: { composerKey: location.state?.composerKey ?? location.key },
        });
      }
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

  const localOnlyFollowUp = isServerFollowUp && initial.thread?.serverComplaintId === undefined;
  const Content = embedded ? 'div' : 'main';
  if (initial.unavailable || localOnlyFollowUp) return <>
    {!embedded ? <ParentMessageHeader title={threadId ? '추가 문의하기' : '새 문의 작성'} /> : null}
    <Content className={embedded ? 'parent-inline-composer' : 'layout-main'}><EmptyState
      title={localOnlyFollowUp ? '서버에 등록되지 않은 문의입니다. 새 문의로 작성해 주세요.' : '작성할 문의를 찾을 수 없습니다.'}
      action={localOnlyFollowUp
        ? <Button onClick={() => navigate('/parent/messages/new?fresh=1')}>새 문의 작성</Button>
        : <Button onClick={() => navigate('/parent/messages')}>문의 내역</Button>} /></Content>
  </>;

  const analysisNotice = threadId
    ? '추가 문의는 기존 문의의 대상과 제목을 그대로 사용합니다. 이어서 전달할 내용을 작성해 주세요.'
    : 'AI 분석 후 내용을 확인하고 전송할 수 있어요.';
  const analysisDetail = threadId ? undefined
    : isServer ? '분석 시작 후 자녀·문의 대상·제목은 변경할 수 없으며, 문의 내용은 계속 수정할 수 있습니다.'
      : '분석 결과를 확인한 뒤 문의를 전송할 수 있습니다.';
  const analysisDescriptionId = 'parent-message-analysis-description';
  const childHelper = children.isLoading ? '자녀 정보를 불러오고 있어요.'
    : children.error || needsStudentName ? <>{getApiErrorMessage(children.error, '자녀 이름을 확인하지 못했어요.')} <button className="parent-write-retry" onClick={children.retry} type="button">다시 시도</button></>
      : serverLocked ? undefined
        : childOptions.length === 0 ? '확인된 자녀 정보가 없습니다. 학교에 학생 연결을 요청해 주세요.' : undefined;
  const teacherHelper = !isServer ? (teacherOptions.length === 0 ? '연결된 선생님이 없습니다. 학교에 교사 연결을 요청해 주세요.' : undefined)
    : !studentId ? undefined
      : recipients.error ? <>{getApiErrorMessage(recipients.error, '선생님 목록을 불러오지 못했어요.')} <button className="parent-write-retry" onClick={recipients.retry} type="button">다시 시도</button></>
        : serverLocked ? undefined
          : recipients.isLoading ? '선생님 목록을 불러오고 있어요.'
            : teacherOptions.length === 0 ? '연결된 선생님이 없습니다. 학교에 교사 연결을 요청해 주세요.' : undefined;

  return (
    <>
      {!embedded ? <ParentMessageHeader title={threadId ? '추가 문의하기' : '새 문의 작성'}
        breadcrumbLabel={threadId ? '추가 문의하기' : '새 문의 작성'} showBack={Boolean(threadId) || isAnalyzing}
        backLabel={isAnalyzing ? '문의 작성으로 돌아가기' : '문의 내역으로 돌아가기'} onBack={handleBack} /> : null}

      <Content className={embedded ? 'parent-inline-composer' : 'layout-main parent-write-main'} aria-busy={isAnalyzing}>
        {embedded ? <div className="parent-inline-composer-heading">
          <h2>추가 문의 작성</h2>
          <Button className="parent-inline-composer-collapse" variant="ghost" disabled={isAnalyzing || needsStudentName}
            aria-label="추가 문의 입력창 접기" aria-expanded={true} aria-controls="parent-inline-follow-up"
            title="입력창 접기 (작성 내용은 임시저장됩니다)" onClick={handleCollapse} rightIcon={<ChevronUp size={18} />}>
            접기
          </Button>
          <p id={analysisDescriptionId}>기존 대화에 이어서 작성합니다. 문의 대상과 제목은 그대로 유지됩니다.</p>
        </div> : null}
        {isServerFollowUp && needsStudentName ? <p role="status">{childHelper}</p> : null}
        {blocked ? <p className="parent-inline-composer-blocked" role="status">현재 문의 상태에서는 추가 문의를 진행할 수 없습니다. 작성한 내용은 임시저장할 수 있어요.</p> : null}
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
              <p>{isServer
                ? 'AI 분석 전 학생명, 교사명, 같은 학급의 제3자 학생명, 전화번호, 이메일, 주민등록번호, 학번, 교직원번호를 가린 문장을 사용합니다.'
                : '전화번호·이메일·주민등록번호와 확인된 이름을 가린 문장으로 AI 분석을 진행하고 있습니다.'}{' '}
                분석이 끝나면 전송할 내용을 직접 확인할 수 있습니다.</p>
            </div>
            {embedded ? <Button onClick={handleBack} variant="outline">문의 작성으로 돌아가기</Button> : null}
          </section>
        ) : (
          <>
            <Accordion className="parent-write-notice" items={[{
              id: 'parent-write-guidelines',
              title: <span className="parent-write-notice-copy">
                <span className="parent-write-notice-title">문의 작성 시 유의사항</span>
                {!embedded ? <span className="parent-write-notice-summary">문의는 전송 후 수정하거나 삭제할 수 없습니다.</span> : null}
              </span>,
              content: <ul>
                {embedded ? <li>문의는 전송 후 수정하거나 삭제할 수 없습니다.</li> : null}
                <li>서로를 배려하는 표현으로 문의를 작성해 주세요.</li>
                <li>폭언, 욕설 등 부적절한 표현은 관련 법령에 따라 문제가 될 수 있습니다.</li>
                <li>개인정보나 계좌번호·카드번호·비밀번호 등 금융정보를 요구받으면 금융사기일 수 있으니 주의해 주세요.</li>
              </ul>,
            }]} />

            <form className="parent-write-form" noValidate onSubmit={handleAnalyze}>
              {canReloadServerDraft ? <div role="alert">
                <p>다른 곳에서 저장한 초안과 내용이 다릅니다. 서버 초안을 불러오면 현재 입력한 내용이 서버의 내용으로 바뀝니다.</p>
                <Button onClick={() => { void reloadServerFollowUp(); }} variant="outline">서버 초안 불러오기</Button>
              </div> : null}
              {embedded && (errors.teacherId || errors.title) ? <p role="alert">{errors.teacherId ?? errors.title}</p> : null}
              {!embedded ? <>
              {isServer && !isServerFollowUp ? <Select containerClassName="parent-write-field" disabled={serverLocked || childOptions.length === 0}
                aria-describedby={analysisDescriptionId}
                error={errors.studentId} helperText={childHelper} id="parent-message-studentId" label="자녀" name="studentId"
                onChange={(event) => selectChild(event.target.value)} options={childOptions}
                placeholder="자녀를 선택해 주세요." required value={studentId ? String(studentId) : ''} /> : null}
              {threadId ? <TextField containerClassName="parent-write-field" error={errors.teacherId} id="parent-message-teacherId"
                aria-describedby={analysisDescriptionId}
                label="문의 대상" readOnly value={initial.thread?.teacherName ?? ''} title="기존 문의의 선생님께 이어서 전달됩니다." trailingIcon={<ChevronDown size={20} />} /> : <Select containerClassName="parent-write-field" error={errors.teacherId}
                disabled={serverLocked || (isServer && teacherOptions.length === 0)} helperText={teacherHelper}
                aria-describedby={analysisDescriptionId}
                id="parent-message-teacherId" label="문의 대상" name="teacherId"
                onChange={(event) => updateField('teacherId', event.target.value)}
                options={teacherOptions} placeholder="선생님을 선택해 주세요." required value={draft.teacherId} />}
              <TextField containerClassName="parent-write-field" error={errors.title}
                aria-describedby={analysisDescriptionId}
                id="parent-message-title" label="문의 제목" maxLength={COMPLAINT_TITLE_MAX_LENGTH} name="title"
                onChange={(event) => updateField('title', event.target.value)}
                placeholder="문의 제목을 입력해 주세요." readOnly={Boolean(threadId) || serverLocked} required value={draft.title} />
              </> : null}
              <TextareaField containerClassName="parent-write-field parent-write-body" error={errors.body}
                id="parent-message-body" label={embedded ? <>문의 내용 <span aria-hidden="true">*</span></> : '문의 내용'} maxLength={MESSAGE_MAX_LENGTH} name="body"
                aria-label={embedded ? '문의 내용' : undefined}
                aria-describedby={embedded ? 'parent-inline-character-count' : undefined}
                onChange={(event) => updateField('body', event.target.value)}
                placeholder={threadId ? '추가로 문의할 내용을 작성해 주세요.' : '선생님께 전달할 문의 내용을 작성해 주세요.'} required rows={6} value={draft.body} />
              <div className="parent-write-guidance">
                {maskingFailed || draft.body.trim() || draft.title.trim() ? <PrivacyMaskingNotice
                  checksClassmateNamesDuringAnalysis={isServer && !threadId}
                  compact
                  inline={embedded}
                  onRetry={() => handleAnalyze()}
                  result={maskingFailed ? { status: 'failed', text: null, count: null }
                    : { status: 'ready', ...maskDraftPreview(`제목: ${draft.title}\n내용: ${draft.body}`, names) }}
                /> : null}
                {embedded ? <p className="parent-inline-character-count" id="parent-inline-character-count">
                  {draft.body.length.toLocaleString('ko-KR')} / {MESSAGE_MAX_LENGTH.toLocaleString('ko-KR')}자
                </p> : <div className="parent-write-analysis-note">
                  {threadId ? <LockKeyhole aria-hidden="true" size={18} /> : <Sparkles aria-hidden="true" size={18} />}
                  <p id={analysisDescriptionId}>
                    <span>{analysisNotice}</span>
                    {analysisDetail ? <span className="sr-only"> {analysisDetail}</span> : null}
                  </p>
                  {analysisDetail ? <InformationTooltip label="AI 분석 안내" content={analysisDetail} /> : null}
                </div>}
              </div>
              <div className="parent-write-footer">
                {embedded ? <p className="parent-inline-save-status" aria-live="polite">
                  {saveFailed ? '임시저장 실패' : savedBody === draft.body ? '임시저장됨'
                    : draftEdits.current > 0 ? '저장되지 않은 변경사항' : '아직 저장하지 않음'}
                </p> : null}
                <div className="parent-write-actions">
                  <Button className="parent-write-save" disabled={needsStudentName} leftIcon={<Save size={18} />} onClick={handleSaveDraft} size="md" variant="outline">임시저장</Button>
                  <Button aria-describedby={analysisDescriptionId} className="parent-write-analyze" disabled={blocked || needsStudentName || teacherOptions.length === 0 || maskingFailed}
                    leftIcon={<Send size={18} />} size="md" type="submit">AI 분석 시작</Button>
                </div>
              </div>
            </form>
          </>
        )}
      </Content>
      {notice ? <Toast message={notice} onClose={dismissNotice} /> : null}
    </>
  );
}
