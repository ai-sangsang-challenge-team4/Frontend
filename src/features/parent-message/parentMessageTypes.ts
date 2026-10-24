export const MESSAGE_MAX_LENGTH = 1500;

export type MessageSource = 'AI' | 'ORIGINAL';
export type MessageSelectionType = MessageSource | 'CUSTOM';
export type RiskExpressionKind = 'repeat' | 'demand' | 'official';

export type RiskExpression = {
  id: string;
  kind: RiskExpressionKind;
  title: string;
  excerpt: string;
  explanation: string;
};

export type ParentMessageAnalysis = {
  status: 'ready' | 'failed';
  revisedText: string | null;
  risks: RiskExpression[];
  meaningWarning: string | null;
};

export type MessageReview = {
  analysis: ParentMessageAnalysis;
  source: MessageSource;
  aiText: string;
  originalEdit: string | null;
};

export type ConsultationStatus = 'before' | 'inProgress' | 'complete';

export type ConversationMessage = {
  id: string;
  authorRole: 'parent' | 'teacher';
  body: string;
  sentAt: string;
};

export type SentParentMessage = {
  parentName?: string;
  messageId: string;
  teacherId: string;
  teacherName: string;
  title: string;
  originalBody: string;
  finalBody: string;
  selectionType: MessageSelectionType;
  selectionSource: MessageSource;
  status: 'SENT';
  sentAt: string;
  auditLog: { action: 'SENT'; at: string; selectionType: MessageSelectionType }[];
  consultationStatus?: ConsultationStatus;
  conversation?: ConversationMessage[];
  isImportant?: boolean;
  needsTeacherReview?: boolean;
  parentAcknowledgedAt?: string;
  updatedAt?: string;
  teacherDraftText?: string;
  teacherDraftSavedAt?: string;
  teacherPinned?: boolean;
};

export function createMessageReview(analysis: ParentMessageAnalysis): MessageReview {
  return {
    analysis,
    source: analysis.revisedText === null ? 'ORIGINAL' : 'AI',
    aiText: analysis.revisedText ?? '',
    originalEdit: null,
  };
}

export function getSelectedMessage(original: string, review: MessageReview) {
  const text = review.source === 'AI' ? review.aiText : review.originalEdit ?? original;
  const baseline = review.source === 'AI' ? review.analysis.revisedText : original;
  const selectionType: MessageSelectionType = text === baseline ? review.source : 'CUSTOM';
  return { text, selectionType };
}

export function validateFinalMessage(text: string) {
  if (!text.trim()) return '전송할 문의 내용을 입력해 주세요.';
  if (text.length > MESSAGE_MAX_LENGTH) return `문의 내용은 ${MESSAGE_MAX_LENGTH}자 이내로 작성해 주세요.`;
  return null;
}

export function maskContactInfo(text: string) {
  let count = 0;
  const masked = text
    .replace(/\b01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}\b/g, () => {
      count += 1;
      return '[전화번호]';
    })
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, () => {
      count += 1;
      return '[이메일]';
    });
  return { text: masked, count };
}
