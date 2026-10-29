import { findSentMessage, mockConnectedTeachers, storeSentMessage, type MessageDraft } from './messageDraft';
import { appendFollowUp, findSentSubmission } from './conversation';
import { requireMaskedText } from '../pii/masking';
import {
  getSelectedMessage,
  validateFinalMessage,
  type MessageReview,
  type ParentMessageAnalysis,
  type RiskExpression,
  type SentParentMessage,
} from './parentMessageTypes';

type MockSettings = { analysisDelayMs: number; sendDelayMs: number; failAnalysis: boolean; failSend: boolean };

function readMockSettings(): MockSettings {
  const defaults = { analysisDelayMs: 3000, sendDelayMs: 700, failAnalysis: false, failSend: false };
  if (!import.meta.env.DEV) return defaults;
  try {
    const value = JSON.parse(localStorage.getItem('teacher-hub.parent-message-mock-settings') ?? '{}');
    if (!value || typeof value !== 'object') return defaults;
    return {
      analysisDelayMs: typeof value.analysisDelayMs === 'number' && Number.isFinite(value.analysisDelayMs)
        ? Math.max(0, Math.min(10000, value.analysisDelayMs)) : defaults.analysisDelayMs,
      sendDelayMs: typeof value.sendDelayMs === 'number' && Number.isFinite(value.sendDelayMs)
        ? Math.max(0, Math.min(10000, value.sendDelayMs)) : defaults.sendDelayMs,
      failAnalysis: value.failAnalysis === true,
      failSend: value.failSend === true,
    };
  } catch {
    return defaults;
  }
}

function waitForMockResponse(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Request aborted', 'AbortError'));
      return;
    }
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException('Request aborted', 'AbortError'));
    };
    const timer = window.setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

const mockRiskRules: (RiskExpression & { replacement: string })[] = [
  {
    id: 'repeated-request', kind: 'repeat', title: '반복적인 요청',
    excerpt: '지난주에도 상담 요청드렸는데', replacement: '지난주에 상담을 요청드렸는데',
    explanation: '이전 요청을 강조하는 표현은 재촉하는 인상을 줄 수 있습니다. 요청한 시점과 아직 안내를 받지 못한 상황을 함께 전달해 보세요.',
  },
  {
    id: 'demanding-schedule', kind: 'demand', title: '부담이 될 수 있는 요구',
    excerpt: '이번 주 안으로 꼭 상담 일정을 잡아주시고', replacement: '가능하다면 이번 주 안으로 상담 일정을 잡을 수 있을지 문의드립니다.',
    explanation: '정해진 기한과 반드시 해야 한다는 표현이 함께 있어 상대에게 부담이 될 수 있습니다. 원하는 일정과 가능한지에 대한 질문을 함께 전달해 보세요.',
  },
  {
    id: 'official-procedure', kind: 'official', title: '법적·공식 절차 언급 가능성',
    excerpt: '계속 이런 식으로 대응하시면 교육청에 민원을 넣는 것도 생각하고 있습니다.',
    replacement: '아이의 상황과 관련하여 빠른 상담이 필요한 상태라 확인 후 회신 부탁드립니다.',
    explanation: '공식 절차를 언급하는 문장은 상대에게 압박으로 받아들여질 수 있습니다. 공식 절차에 관한 의사가 수정안에서도 정확히 전달되는지 직접 확인해 주세요.',
  },
];

export const OFFICIAL_MEANING_WARNING = 'AI 초안에서 공식 절차에 관한 의사가 완화되었을 수 있습니다. 원문과 비교하여 전달하려는 의미가 유지되는지 확인해 주세요.';

// Local preview rules only (VITE_MESSAGE_API=mock). The server flow is in serverComplaint.ts.
export function createMockAnalysis(original: string): ParentMessageAnalysis {
  const matched = mockRiskRules.filter((rule) => original.includes(rule.excerpt));
  let revised = original;
  for (const rule of matched) revised = revised.split(rule.excerpt).join(rule.replacement);
  if (matched.length > 0) {
    revised = revised
      .split('아직 아무 연락이 없으시네요.').join('아직 관련 안내를 받지 못해 다시 연락드립니다.')
      .split('아이가 학교생활 때문에 계속 힘들어하고 있는데 언제까지 기다려야 하는 건가요?').join('아이가 최근 학교생활로 계속 어려움을 겪고 있어,')
      .split('지금까지 왜 아무 조치가 없었는지도 설명해 주세요.').join('또한 지난 상담 요청 이후 현재까지 확인되거나 진행된 사항이 있다면 함께 안내해 주시면 감사하겠습니다.')
      .replace(/\.\s+/g, '.\n\n');
  }
  return {
    status: 'ready',
    revisedText: revised === original ? null : revised,
    risks: matched.map(({ id, kind, title, excerpt, explanation }) => ({ id, kind, title, excerpt, explanation })),
    meaningWarning: matched.some((rule) => rule.kind === 'official') ? OFFICIAL_MEANING_WARNING : null,
  };
}

export async function analyzeParentMessage(draft: MessageDraft, signal: AbortSignal) {
  // Stop before analysis if the privacy check fails, including when there is no detected PII.
  const maskedBody = requireMaskedText(draft.body);
  const settings = readMockSettings();
  await waitForMockResponse(settings.analysisDelayMs, signal);
  if (settings.failAnalysis || !navigator.onLine) throw new Error('AI 분석을 완료하지 못했습니다.');
  return createMockAnalysis(maskedBody);
}

export async function sendParentMessage(
  userId: number,
  draft: MessageDraft,
  review: MessageReview,
  signal: AbortSignal,
  parentName?: string,
): Promise<SentParentMessage> {
  let existing;
  try {
    existing = findSentSubmission(userId, draft);
  } catch {
    throw new Error('문의 내역을 확인하지 못했습니다. 다시 시도해 주세요.');
  }
  if (existing) return existing;
  if (draft.threadId && !findSentMessage(userId, draft.threadId)) throw new Error('기존 문의를 찾을 수 없습니다.');
  const selected = getSelectedMessage(draft.body, review);
  const error = validateFinalMessage(selected.text);
  if (error) throw new Error(error);
  const teacher = mockConnectedTeachers.find((item) => item.value === draft.teacherId);
  if (!teacher || !draft.title.trim()) throw new Error('문의 대상과 제목을 다시 확인해 주세요.');
  // Check the final selection again: the user may have edited it since analysis.
  const maskedBody = requireMaskedText(selected.text.trim());
  const maskedTitle = requireMaskedText(draft.title.trim());
  const maskedOriginalBody = requireMaskedText(draft.body);
  const settings = readMockSettings();
  await waitForMockResponse(settings.sendDelayMs, signal);
  if (settings.failSend || !navigator.onLine) throw new Error('문의를 전송하지 못했습니다. 연결 상태를 확인한 후 다시 시도해 주세요.');

  const persist = () => {
    signal.throwIfAborted();
    const sentAt = new Date().toISOString();
    const message: SentParentMessage = {
      parentName,
      messageId: draft.messageId,
      teacherId: draft.teacherId,
      teacherName: teacher.label,
      title: maskedTitle,
      originalBody: maskedOriginalBody,
      finalBody: maskedBody,
      selectionType: selected.selectionType,
      selectionSource: review.source,
      status: 'SENT',
      sentAt,
      auditLog: [{ action: 'SENT', at: sentAt, selectionType: selected.selectionType }],
      consultationStatus: 'before',
    };
    try {
      return draft.threadId ? appendFollowUp(userId, draft, message) : storeSentMessage(userId, message);
    } catch {
      throw new Error('문의를 저장하지 못했습니다. 작성한 내용은 유지됩니다. 다시 시도해 주세요.');
    }
  };

  // Serialize browser-local retries; the real API must enforce the same message ID.
  return navigator.locks
    ? navigator.locks.request(`parent-message-send.${userId}`, { signal }, persist)
    : persist();
}
