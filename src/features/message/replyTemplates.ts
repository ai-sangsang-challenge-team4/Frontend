import type { BoardThread } from './types';

// A High reply template is a fixed sequence of five blocks; teachers cannot add, remove or reorder them.
export type ReplyTemplateBlockKind = 'GREETING' | 'ACKNOWLEDGE' | 'PRINCIPLE' | 'NEXT_STEP' | 'CLOSING';
export type ReplyTemplateBlockMode = 'LOCKED' | 'VARIABLE_ONLY' | 'SELECT_ONE' | 'EDITABLE';
export type ReplyTemplateStatus = 'ACTIVE' | 'INACTIVE';

export type ReplyTemplateBlock = {
  blockId: string;
  kind: ReplyTemplateBlockKind;
  mode: ReplyTemplateBlockMode;
  // SELECT_ONE uses options (the first is the default); the other modes use text.
  options?: string[];
  text?: string;
};

export type ReplyTemplate = {
  approved: boolean;
  blocks: ReplyTemplateBlock[];
  description: string;
  matchFactorIds: string[];
  status: ReplyTemplateStatus;
  templateId: string;
  title: string;
  version: number;
};

// Variables use {{key}}. Auto-filled keys are replaced; the rest stay as [label] chips the teacher must fill.
const autoVariables: Record<string, (thread: BoardThread, teacherName: string) => string> = {
  parentTitle: (thread) => thread.parentName.replace(/\s*학부모$/, ''),
  studentName: (thread) => thread.studentName || '[학생 이름]',
  teacherName: (_thread, teacherName) => teacherName,
  topic: (thread) => thread.conversationSummary?.topic ?? thread.title,
};

const teacherVariableLabels: Record<string, string> = {
  consultationSlot: '상담 일시 선택',
};

// Example wording only. Real wording must be confirmed against official policy and external review.
export const replyTemplates: ReplyTemplate[] = [
  {
    templateId: 'tpl-repeat-request',
    title: '같은 요청이 반복될 때',
    description: '학교 규정을 안내하고 공식 창구로 연결해요',
    version: 1,
    status: 'ACTIVE',
    approved: false,
    matchFactorIds: ['factor-repeat', 'factor-accountability'],
    blocks: [
      { blockId: 'greeting', kind: 'GREETING', mode: 'VARIABLE_ONLY', text: '{{parentTitle}} 보호자님, 안녕하세요. {{studentName}} 담임 {{teacherName}}입니다.' },
      { blockId: 'acknowledge', kind: 'ACKNOWLEDGE', mode: 'EDITABLE', text: '보내주신 {{topic}} 관련 말씀은 잘 확인했습니다. 다시 한 번 살펴보겠습니다.' },
      { blockId: 'principle', kind: 'PRINCIPLE', mode: 'LOCKED', text: '관련 사항은 학교 규정에 따라 처리되며, 개별 요청에 따라 기준을 달리 적용하기는 어렵다는 점 양해 부탁드립니다.' },
      { blockId: 'next-step', kind: 'NEXT_STEP', mode: 'SELECT_ONE', options: ['추가 문의는 학교 민원 대응팀으로 부탁드립니다.', '필요하시면 학교에서 대면 상담을 잡아드리겠습니다.'] },
      { blockId: 'closing', kind: 'CLOSING', mode: 'LOCKED', text: '감사합니다.' },
    ],
  },
  {
    templateId: 'tpl-student-observation',
    title: '학생 생활 확인을 요청할 때',
    description: '학교 생활 관찰과 상담 연계 절차를 안내해요',
    version: 1,
    status: 'ACTIVE',
    approved: false,
    matchFactorIds: ['factor-home-change', 'factor-student-safety'],
    blocks: [
      { blockId: 'greeting', kind: 'GREETING', mode: 'VARIABLE_ONLY', text: '{{parentTitle}} 보호자님, 안녕하세요. {{studentName}} 담임 {{teacherName}}입니다.' },
      { blockId: 'acknowledge', kind: 'ACKNOWLEDGE', mode: 'EDITABLE', text: '보내주신 {{topic}} 관련 말씀은 잘 확인했습니다.' },
      { blockId: 'principle', kind: 'PRINCIPLE', mode: 'LOCKED', text: '학교에서는 학생 생활 관찰 기록 절차에 따라 학교 생활을 살피고, 필요한 경우 상담 연계 절차를 안내드리고 있습니다.' },
      { blockId: 'next-step', kind: 'NEXT_STEP', mode: 'SELECT_ONE', options: ['{{consultationSlot}}에 상담을 진행할 수 있도록 일정을 안내드리겠습니다.', '관찰 내용은 학교 상담 창구를 통해 안내드리겠습니다.'] },
      { blockId: 'closing', kind: 'CLOSING', mode: 'LOCKED', text: '감사합니다.' },
    ],
  },
];

// Expressions that can read as a promise or a guarantee. Shown as a warning before sending.
const cautionExpressions = ['반드시', '무조건', '책임지고', '약속드립니다', '보장합니다'];

export function findReplyTemplate(thread: BoardThread) {
  const factorIds = new Set(thread.analysis?.riskFactors.map((factor) => factor.id) ?? []);
  return replyTemplates.find((template) => (
    template.status === 'ACTIVE' && template.matchFactorIds.some((id) => factorIds.has(id))
  ));
}

export function getReplyTemplate(templateId?: string) {
  return replyTemplates.find((template) => template.templateId === templateId);
}

export function renderReplyTemplate(template: ReplyTemplate, thread: BoardThread, teacherName: string) {
  const fill = (text: string) => text.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const autoValue = autoVariables[key]?.(thread, teacherName);
    return autoValue ?? `[${teacherVariableLabels[key] ?? key}]`;
  });

  return template.blocks
    .map((block) => fill(block.mode === 'SELECT_ONE' ? block.options?.[0] ?? '' : block.text ?? ''))
    .filter(Boolean)
    .join('\n\n');
}

// Required teacher-input chips that are still unfilled block sending.
export function getUnfilledTemplateVariables(text: string) {
  const labels = Object.values(teacherVariableLabels).concat('학생 이름');
  return labels.filter((label) => text.includes(`[${label}]`));
}

export function findCautionExpressions(text: string) {
  return cautionExpressions.filter((expression) => text.includes(expression));
}
