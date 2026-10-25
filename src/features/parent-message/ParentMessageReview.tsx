import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Eye, Gavel, Pencil, Repeat2, RotateCcw, Save, Send, UserRoundX } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { Accordion, Button, EmptyState, Modal, Tabs, TextareaField, Toast } from '../../shared/components/ui';
import { clearMessageDraft, mockConnectedTeachers, readMessageDraft, saveMessageDraft, type MessageDraft } from './messageDraft';
import { ParentMessageHeader } from './ParentMessageHeader';
import { createMockAnalysis, sendParentMessage } from './parentMessageApi';
import { findSentSubmission, findSentSubmissionById, getDraftPath } from './conversation';
import { checkPersonalInfo, MaskingError, PrivacyMaskingNotice } from '../pii';
import { AiJudgmentNotice } from '../safety/AiJudgmentNotice';
import {
  createMessageReview,
  getSelectedMessage,
  maskContactInfo,
  MESSAGE_MAX_LENGTH,
  validateFinalMessage,
  type MessageReview,
  type MessageSource,
  type RiskExpression,
} from './parentMessageTypes';
import './ParentMessageReview.css';

const riskIcons = { repeat: Repeat2, demand: UserRoundX, official: Gavel };
const selectionLabels = { AI: 'AI 초안', ORIGINAL: '원문', CUSTOM: '직접 수정' };

function HighlightedMessage({ text, risks, onSelect }: {
  text: string;
  risks: RiskExpression[];
  onSelect: (riskId: string) => void;
}) {
  const ranges = risks.flatMap((risk) => {
    const matches: { start: number; end: number; risk: RiskExpression }[] = [];
    if (!risk.excerpt) return matches;
    let start = text.indexOf(risk.excerpt);
    while (start >= 0) {
      matches.push({ start, end: start + risk.excerpt.length, risk });
      start = text.indexOf(risk.excerpt, start + risk.excerpt.length);
    }
    return matches;
  }).sort((left, right) => left.start - right.start);
  let offset = 0;
  const parts = [];
  for (const range of ranges) {
    if (range.start < offset) continue;
    parts.push(text.slice(offset, range.start));
    parts.push(
      <mark
        key={`${range.risk.id}-${range.start}`}
        onClick={() => onSelect(range.risk.id)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect(range.risk.id);
          }
        }}
        role="button"
        tabIndex={0}
        title={range.risk.title}
      >
        {text.slice(range.start, range.end)}
      </mark>,
    );
    offset = range.end;
  }
  parts.push(text.slice(offset));
  return <p>{parts}</p>;
}

export function ParentMessageReview({ userId, messageId }: { userId: number; messageId: string }) {
  const [initial] = useState(() => {
    try {
      const draft = readMessageDraft(userId, messageId);
      return { draft, sent: draft ? findSentSubmission(userId, draft) : findSentSubmissionById(userId, messageId), error: null };
    } catch {
      return { draft: null, sent: null, error: '문의 정보를 불러오지 못했습니다. 다시 시도해 주세요.' };
    }
  });
  if (initial.sent) return <Navigate replace to={`/parent/messages/${initial.sent.messageId}`} />;
  if (!initial.draft || initial.draft.messageId !== messageId || initial.draft.status !== 'PARENT_REVIEW') {
    return (
      <>
        <ParentMessageHeader />
        <main className="layout-main">
          <EmptyState title={initial.error ?? '검토할 문의를 찾을 수 없습니다.'}
            action={<Button onClick={() => window.location.assign('/parent/messages/new')}>새 문의 작성</Button>} />
        </main>
      </>
    );
  }
  return <MessageReviewEditor draft={initial.draft} userId={userId} />;
}

function MessageReviewEditor({ draft, userId }: { draft: MessageDraft; userId: number }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [review, setReview] = useState<MessageReview>(() => {
    const restored = draft.review ?? createMessageReview(createMockAnalysis(maskContactInfo(draft.body).text));
    return restored.analysis.revisedText === draft.body ? { ...restored, source: 'ORIGINAL' } : restored;
  });
  const [isEditingOriginal, setIsEditingOriginal] = useState(review.originalEdit !== null);
  const [isRiskListOpen, setIsRiskListOpen] = useState(true);
  const [openRiskIds, setOpenRiskIds] = useState<string[]>([]);
  const [dialog, setDialog] = useState<'preview' | 'confirm' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [maskingFailed, setMaskingFailed] = useState(false);
  const sendPending = useRef(false);
  const sendController = useRef<AbortController | null>(null);
  const dismissNotice = useCallback(() => setNotice(null), []);
  const selected = getSelectedMessage(draft.body, review);
  const masked = maskContactInfo(selected.text.trim());
  const privacyPreview = maskContactInfo(`제목: ${draft.title}\n\n내용: ${selected.text.trim()}`);
  const teacher = mockConnectedTeachers.find((item) => item.value === draft.teacherId);
  const hasAiDraft = review.analysis.revisedText !== null && review.analysis.revisedText !== draft.body;

  useEffect(() => () => sendController.current?.abort(), []);

  function persistReview() {
    saveMessageDraft(userId, { ...draft, status: 'PARENT_REVIEW', review });
  }

  function handleSave() {
    const validation = validateFinalMessage(selected.text);
    setError(validation);
    if (validation) return;
    try {
      persistReview();
      setNotice('선택한 문의가 임시저장되었습니다.');
    } catch {
      setNotice('임시저장하지 못했습니다. 작성한 내용은 유지됩니다.');
    }
  }

  function handleOpenDialog(mode: 'preview' | 'confirm') {
    const validation = validateFinalMessage(selected.text);
    setError(validation);
    if (validation) {
      document.getElementById('parent-review-editor')?.focus();
      return;
    }
    if (!teacher) {
      setNotice('연결된 선생님을 확인한 후 다시 작성해 주세요.');
      return;
    }
    if (checkPersonalInfo(selected.text).status === 'failed') {
      setMaskingFailed(true);
      return;
    }
    setMaskingFailed(false);
    setDialog(mode);
  }

  async function handleSend() {
    if (sendPending.current) return;
    sendPending.current = true;
    setIsSending(true);
    const controller = new AbortController();
    sendController.current = controller;
    try {
      persistReview();
      const sent = await sendParentMessage(userId, draft, review, controller.signal, user?.name);
      if (controller.signal.aborted) return;
      try {
        clearMessageDraft(userId, draft.messageId);
      } catch {
        // The sent record remains authoritative if draft cleanup fails.
      }
      navigate(`/parent/messages/${sent.messageId}`, { replace: true, state: { justSent: true } });
    } catch (failure) {
      if (!controller.signal.aborted) {
        if (failure instanceof MaskingError) {
          setMaskingFailed(true);
          setDialog(null);
          return;
        }
        setNotice(failure instanceof DOMException
          ? '문의 내용을 저장하지 못했습니다. 작성한 내용은 유지됩니다.'
          : failure instanceof Error ? failure.message : '문의를 전송하지 못했습니다. 다시 시도해 주세요.');
      }
    } finally {
      sendPending.current = false;
      if (!controller.signal.aborted) setIsSending(false);
    }
  }

  function handleBack() {
    try {
      persistReview();
      navigate(draft.threadId ? getDraftPath(draft) : '/parent/messages/new');
    } catch {
      setNotice('작성한 내용을 저장하지 못했습니다. 임시저장 후 다시 시도해 주세요.');
    }
  }

  function selectRisk(riskId: string) {
    setIsRiskListOpen(true);
    setOpenRiskIds((previous) => previous.includes(riskId) ? previous : [...previous, riskId]);
    window.requestAnimationFrame(() => {
      const trigger = document.getElementById(`${riskId}-accordion-trigger`);
      trigger?.focus({ preventScroll: true });
      trigger?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }

  function renderEditor(source: MessageSource) {
    const isOriginal = source === 'ORIGINAL';
    const isEditable = !isOriginal || isEditingOriginal;
    const value = isOriginal ? review.originalEdit ?? draft.body : review.aiText;
    return (
      <>
        {isEditable ? (
          <TextareaField
            aria-label={isOriginal ? '직접 수정한 문의 내용' : 'AI 초안 내용'}
            containerClassName="parent-review-field"
            error={error}
            id="parent-review-editor"
            maxLength={MESSAGE_MAX_LENGTH}
            onChange={(event) => {
              const text = event.target.value;
              setReview((previous) => isOriginal
                ? { ...previous, originalEdit: text } : { ...previous, aiText: text });
              setError(null);
              setMaskingFailed(false);
            }}
            rows={12}
            value={value}
          />
        ) : (
          <div aria-label="원문 내용" className="parent-review-original" tabIndex={0}>
            <HighlightedMessage onSelect={selectRisk} risks={review.analysis.risks} text={draft.body} />
          </div>
        )}
        {!isEditable && error ? <p className="ui-field-error" role="alert">{error}</p> : null}
        <div className="parent-review-editor-meta">
          <span className={value.length > MESSAGE_MAX_LENGTH ? 'is-invalid' : ''}>{value.length}/{MESSAGE_MAX_LENGTH}</span>
          <span className="parent-review-hint">
            {isOriginal ? 'AI 초안은 참고용이므로, 전송 전 반드시 확인해주세요.' : 'AI 수정안을 바탕으로 자유롭게 수정해보세요.'}
          </span>
          {isOriginal && !isEditingOriginal ? (
            <Button leftIcon={<Pencil size={18} />} onClick={() => {
              setIsEditingOriginal(true);
              window.requestAnimationFrame(() => document.getElementById('parent-review-editor')?.focus());
            }} size="sm" variant="ghost">직접 수정</Button>
          ) : value !== (isOriginal ? draft.body : review.analysis.revisedText) ? (
            <button aria-label={isOriginal ? '원문 복원' : 'AI 초안 복원'} className="parent-review-reset"
              onClick={() => {
                setReview((previous) => isOriginal
                  ? { ...previous, originalEdit: null } : { ...previous, aiText: previous.analysis.revisedText ?? '' });
                if (isOriginal) setIsEditingOriginal(false);
                setError(null);
              }} title={isOriginal ? '원문 복원' : 'AI 초안 복원'} type="button">
              <RotateCcw aria-hidden="true" size={18} />
            </button>
          ) : null}
        </div>
      </>
    );
  }

  return (
    <>
      <ParentMessageHeader title={draft.threadId ? '추가 문의하기' : '새 문의 작성'} onBack={handleBack} />
      <main className="layout-main parent-review-main">
        <section aria-label="문의 문장 선택" className="parent-review-editor">
          <Tabs
            ariaLabel="전송할 문의 문장"
            className="parent-review-tabs"
            items={[
              { value: 'AI', label: 'AI 초안', disabled: !hasAiDraft, content: renderEditor('AI') },
              { value: 'ORIGINAL', label: '원문', content: renderEditor('ORIGINAL') },
            ]}
            onValueChange={(source) => {
              setReview((previous) => ({ ...previous, source: source as MessageSource }));
              setError(null);
              setMaskingFailed(false);
            }}
            value={review.source}
          />
          {!hasAiDraft ? (
            <p className="parent-review-analysis-notice" role="status">
              {review.analysis.status === 'failed'
                ? 'AI 수정안을 불러오지 못했습니다. 원문을 확인하거나 직접 수정해 전송할 수 있습니다.'
                : '원문과 다른 AI 수정안이 없습니다. 원문을 확인해 주세요.'}
            </p>
          ) : review.source === 'AI' && review.analysis.meaningWarning ? (
            <p className="parent-review-meaning-notice" role="note">{review.analysis.meaningWarning}</p>
          ) : null}
        </section>

        <PrivacyMaskingNotice
          onRetry={() => setMaskingFailed(checkPersonalInfo(selected.text).status === 'failed')}
          result={maskingFailed ? { status: 'failed', text: null, count: null } : { status: 'ready', ...privacyPreview }}
        />
        <AiJudgmentNotice />

        {review.source === 'ORIGINAL' && review.analysis.risks.length > 0 ? (
          <section aria-labelledby="parent-review-risks-title" className="parent-review-risks">
            <div className="parent-review-risks-heading">
              <Eye aria-hidden="true" size={24} />
              <h2 id="parent-review-risks-title">탐지된 위험 표현 목록 ({review.analysis.risks.length})</h2>
              <button aria-controls="parent-review-risks-list" aria-expanded={isRiskListOpen}
                aria-label={isRiskListOpen ? '주의 표현 목록 접기' : '주의 표현 목록 펼치기'}
                className="parent-review-risk-toggle" onClick={() => setIsRiskListOpen((previous) => !previous)}
                title={isRiskListOpen ? '주의 표현 목록 접기' : '주의 표현 목록 펼치기'} type="button">
                {isRiskListOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
            </div>
            <div hidden={!isRiskListOpen} id="parent-review-risks-list">
              <Accordion allowMultiple className="parent-review-risk-accordion" onValueChange={setOpenRiskIds}
                items={review.analysis.risks.map((risk) => {
                  const Icon = riskIcons[risk.kind];
                  return {
                    id: risk.id,
                    title: <>
                      <span className="parent-review-risk-label"><Icon aria-hidden="true" size={20} />{risk.title}</span>
                      <span className="parent-review-risk-excerpt"><mark>&quot;{risk.excerpt}&quot;</mark></span>
                    </>,
                    content: <p>{risk.explanation}</p>,
                  };
                })} value={openRiskIds} />
            </div>
          </section>
        ) : null}

        <div className="parent-write-actions parent-review-actions">
          <Button leftIcon={<Save size={22} />} onClick={handleSave} size="lg" variant="outline">임시저장</Button>
          <div className="parent-review-send-actions">
            <Button disabled={maskingFailed} leftIcon={<Eye size={22} />} onClick={() => handleOpenDialog('preview')} size="lg" variant="outline">미리보기</Button>
            <Button disabled={maskingFailed} leftIcon={<Send size={22} />} onClick={() => handleOpenDialog('confirm')} size="lg">전송하기</Button>
          </div>
        </div>
      </main>

      <Modal className="parent-review-dialog" closeOnOverlayClick={!isSending}
        description={dialog === 'confirm' ? '전송 후에는 문의를 수정하거나 삭제할 수 없습니다. 최종 문장을 확인해 주세요.' : undefined}
        onOpenChange={(open) => { if (!open && !isSending) setDialog(null); }} open={dialog !== null} size="lg"
        title={dialog === 'confirm' ? '문의를 전송할까요?' : '문의 미리보기'}
        footer={dialog === 'confirm' ? <>
          <Button disabled={isSending} onClick={() => setDialog(null)} variant="outline">취소</Button>
          <Button isLoading={isSending} leftIcon={<Send size={20} />} onClick={() => { void handleSend(); }}>확인 후 전송</Button>
        </> : <Button onClick={() => setDialog(null)} variant="outline">닫기</Button>}>
        <dl className="parent-review-preview-meta">
          <dt>문의 대상</dt><dd>{teacher?.label}</dd>
          <dt>문의 제목</dt><dd>{maskContactInfo(draft.title).text}</dd>
          <dt>선택 문장</dt><dd>{selectionLabels[selected.selectionType]}</dd>
        </dl>
        {privacyPreview.count > 0 ? <p className="parent-review-meaning-notice">전화번호 또는 이메일 {privacyPreview.count}건을 가린 문장으로 전송합니다.</p> : null}
        <p className="parent-review-preview-body">{masked.text}</p>
      </Modal>
      {notice ? <Toast message={notice} onClose={dismissNotice} /> : null}
    </>
  );
}
