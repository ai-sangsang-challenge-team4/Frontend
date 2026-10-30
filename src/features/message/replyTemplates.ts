import { formatMessageDate } from '../parent-message/conversation';
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
  maxLength?: number;
};

export type ReplyTemplateDraft = {
  templateId: string;
  version: number;
  variables: Record<string, string>;
  editableBlocks: Record<string, string>;
  selectedOptions: Record<string, number>;
};

export type ReplyTemplateChange =
  | { type: 'variable'; key: string; value: string }
  | { type: 'text'; blockId: string; value: string }
  | { type: 'option'; blockId: string; index: number };

export type ReplyTemplate = {
  approved: boolean;
  // Server templates (GET /response-templates): the version to record on POST /adoptions, and the
  // variables the teacher fills in, with their labels. Browser examples use the shared variables below.
  serverVersionId?: number;
  teacherVariables?: Record<string, string>;
  blocks: ReplyTemplateBlock[];
  description: string;
  matchFactorIds: string[];
  status: ReplyTemplateStatus;
  templateId: string;
  title: string;
  version: number;
};

// Variables use {{key}}, as the server writes them. Auto-filled keys are replaced; the rest stay as [label]
// chips the teacher must fill.
export const TEMPLATE_VARIABLE_PATTERN = /\{\{\s*([\w.-]+)\s*\}\}/g;

const autoVariables: Record<string, (thread: BoardThread, teacherName: string) => string> = {
  parentTitle: (thread) => thread.parentName.replace(/\s*학부모$/, ''),
  studentName: (thread) => thread.studentName || '자녀분',
  teacherName: (_thread, teacherName) => teacherName,
  topic: (thread) => thread.conversationSummary?.topic ?? thread.title,
};

const teacherVariableLabels: Record<string, string> = {
  parentTitle: '보호자 호칭',
  consultationSlot: '상담 일시 선택',
};

export const templateVariableLabels: Record<string, string> = {
  ...teacherVariableLabels,
  studentName: '학생 이름',
  teacherName: '교사 이름',
  topic: '문의 주제',
};

// The picker stores a Seoul wall-clock value, independent of the browser's timezone.
export function isConsultationDateTime(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) || value.startsWith('0000-')) return false;
  const date = new Date(`${value}:00+09:00`);
  return !Number.isNaN(date.getTime()) &&
    new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 16) === value;
}

export function formatConsultationDateTime(value: string) {
  return isConsultationDateTime(value) ? formatMessageDate(`${value}:00+09:00`) : '';
}

export function isTeacherVariable(key: string, template?: ReplyTemplate) {
  return Object.prototype.hasOwnProperty.call(template?.teacherVariables ?? teacherVariableLabels, key);
}

// Server templates may list a required variable that no {{slot}} shows; it still needs a value for POST /adoptions.
export function unplacedTeacherVariables(template: ReplyTemplate) {
  const placed = new Set(template.blocks.flatMap((block) => [block.text ?? '', ...(block.options ?? [])])
    .flatMap((text) => [...text.matchAll(TEMPLATE_VARIABLE_PATTERN)].map((match) => match[1])));
  return Object.keys(template.teacherVariables ?? {}).filter((key) => !placed.has(key));
}

export function templateVariableLabel(key: string, template?: ReplyTemplate) {
  return template?.teacherVariables?.[key] ?? templateVariableLabels[key] ?? key;
}

export function templateVariableValue(
  key: string,
  thread: BoardThread,
  teacherName: string,
  draft: ReplyTemplateDraft,
  template?: ReplyTemplate,
) {
  if (key === 'consultationSlot') return formatConsultationDateTime(draft.variables[key] ?? '');
  if (isTeacherVariable(key, template)) return draft.variables[key] ?? '';
  return autoVariables[key]?.(thread, teacherName) ?? '';
}

export function templateBlockText(block: ReplyTemplateBlock, draft: ReplyTemplateDraft) {
  if (block.mode === 'SELECT_ONE') return block.options?.[draft.selectedOptions[block.blockId]] ?? '';
  return block.text ?? '';
}

function fillTemplateText(
  text: string,
  thread: BoardThread,
  teacherName: string,
  draft: ReplyTemplateDraft,
  template?: ReplyTemplate,
) {
  return text.replace(TEMPLATE_VARIABLE_PATTERN, (_match, key: string) =>
    templateVariableValue(key, thread, teacherName, draft, template).trim() || `[${templateVariableLabel(key, template)}]`,
  );
}

// Server template variables filled in from the thread; the teacher can still change them.
const serverVariableDefaults: Record<string, (thread: BoardThread, teacherName: string) => string> = {
  parentName: autoVariables.parentTitle,
  issueSummary: autoVariables.topic,
};

// Cut to 80 UTF-16 units without leaving half of a surrogate pair (an emoji) at the end.
const truncateVariable = (text: string) => {
  const cut = text.slice(0, 80);
  return /[\uD800-\uDBFF]$/.test(cut) ? cut.slice(0, -1) : cut;
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

// A server thread uses only the server's templates; it has no browser examples.
export function findReplyTemplates(thread: BoardThread) {
  if (thread.serverComplaintId !== undefined) return thread.serverTemplates ?? [];
  const factorIds = new Set(thread.analysis?.riskFactors.map((factor) => factor.id) ?? []);
  return replyTemplates.filter((template) => (
    template.status === 'ACTIVE' && template.matchFactorIds.some((id) => factorIds.has(id))
  ));
}

export function findReplyTemplate(thread: BoardThread) {
  return findReplyTemplates(thread)[0];
}

export function getReplyTemplate(templateId?: string, thread?: BoardThread) {
  const templates = thread?.serverComplaintId !== undefined ? thread.serverTemplates ?? [] : replyTemplates;
  return templates.find((template) => template.templateId === templateId);
}

export function createReplyTemplateDraft(template: ReplyTemplate, thread: BoardThread, teacherName: string, previous?: ReplyTemplateDraft): ReplyTemplateDraft {
  const compatible = previous?.templateId === template.templateId ? previous : undefined;
  const draft: ReplyTemplateDraft = {
    templateId: template.templateId,
    version: template.version,
    variables: {
      ...(template.teacherVariables
        ? Object.fromEntries(Object.keys(template.teacherVariables).map((key) => [
          key,
          // Variables are capped at 80 characters, and a long inquiry title must not block saving.
          truncateVariable(serverVariableDefaults[key]?.(thread, teacherName) ?? ''),
        ]))
        : { parentTitle: autoVariables.parentTitle(thread, teacherName), consultationSlot: '' }),
      ...compatible?.variables,
    },
    editableBlocks: {},
    selectedOptions: {},
  };
  for (const block of template.blocks) {
    if (block.mode === 'EDITABLE') {
      draft.editableBlocks[block.blockId] = compatible?.editableBlocks[block.blockId]
        ?? fillTemplateText(block.text ?? '', thread, teacherName, draft, template);
    }
    if (block.mode === 'SELECT_ONE') {
      const previousOption = compatible?.selectedOptions[block.blockId];
      draft.selectedOptions[block.blockId] = previousOption !== undefined && block.options?.[previousOption] ? previousOption : 0;
    }
  }
  return draft;
}

// Only the fields allowed by the template can enter the serialized reply.
export function changeReplyTemplateDraft(template: ReplyTemplate, draft: ReplyTemplateDraft, change: ReplyTemplateChange): ReplyTemplateDraft {
  if (change.type === 'variable' && isTeacherVariable(change.key, template) && change.value.length <= 80) {
    return { ...draft, variables: { ...draft.variables, [change.key]: change.value } };
  }
  if (change.type === 'text') {
    const block = template.blocks.find((item) => item.blockId === change.blockId && item.mode === 'EDITABLE');
    if (block && change.value.length <= (block.maxLength ?? 150)) {
      return { ...draft, editableBlocks: { ...draft.editableBlocks, [change.blockId]: change.value } };
    }
  }
  if (change.type === 'option') {
    const block = template.blocks.find((item) => item.blockId === change.blockId && item.mode === 'SELECT_ONE');
    if (Number.isInteger(change.index) && block?.options?.[change.index]) {
      return { ...draft, selectedOptions: { ...draft.selectedOptions, [change.blockId]: change.index } };
    }
  }
  return draft;
}

export function renderReplyTemplate(template: ReplyTemplate, thread: BoardThread, teacherName: string, draft = createReplyTemplateDraft(template, thread, teacherName)) {
  return template.blocks
    .map((block) => block.mode === 'EDITABLE'
      ? (draft.editableBlocks[block.blockId] ?? '').trim()
      : fillTemplateText(templateBlockText(block, draft), thread, teacherName, draft, template))
    .join('\n\n');
}

export function validateReplyTemplate(template: ReplyTemplate, draft: ReplyTemplateDraft, thread: BoardThread, teacherName: string, serializedText: string) {
  const errors: string[] = [];
  if (template.status !== 'ACTIVE' || template.templateId !== draft.templateId || template.version !== draft.version) {
    errors.push('사용할 수 없는 예시입니다. 최신 예시를 다시 적용해 주세요.');
  }
  for (const block of template.blocks) {
    if (block.mode === 'EDITABLE') {
      const value = draft.editableBlocks[block.blockId] ?? '';
      if (!value.trim()) errors.push('직접 고칠 문장을 입력해 주세요.');
      if (value.length > (block.maxLength ?? 150)) errors.push(`직접 고칠 문장은 ${block.maxLength ?? 150}자 이내로 입력해 주세요.`);
    } else {
      if (block.mode === 'SELECT_ONE' && (!Number.isInteger(draft.selectedOptions[block.blockId]) || !block.options?.[draft.selectedOptions[block.blockId]])) {
        errors.push('마지막 안내를 하나 골라 주세요.');
      }
      // Variables in an unselected option are intentionally not required.
      for (const match of templateBlockText(block, draft).matchAll(TEMPLATE_VARIABLE_PATTERN)) {
        if (match[1] === 'consultationSlot') {
          if (!isConsultationDateTime(draft.variables.consultationSlot ?? '')) errors.push('상담 날짜와 시간을 선택해 주세요.');
          continue;
        }
        const value = templateVariableValue(match[1], thread, teacherName, draft, template);
        if (!value.trim() || value.length > 80) errors.push(`${templateVariableLabel(match[1], template)}을 입력해 주세요.`);
      }
    }
  }
  for (const key of unplacedTeacherVariables(template)) {
    const value = draft.variables[key] ?? '';
    if (!value.trim() || value.length > 80) errors.push(`${templateVariableLabel(key, template)}을 입력해 주세요.`);
  }
  if (serializedText.trim() !== renderReplyTemplate(template, thread, teacherName, draft).trim()) {
    errors.push('예시의 고정 문장이 변경되었습니다. 예시를 다시 적용해 주세요.');
  }
  return [...new Set(errors)];
}

export function findCautionExpressions(text: string) {
  return cautionExpressions.filter((expression) => text.includes(expression));
}

export function isReplyTemplateDraft(value: unknown): value is ReplyTemplateDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Partial<ReplyTemplateDraft>;
  const isStringMap = (map: unknown) => Boolean(map && typeof map === 'object' && !Array.isArray(map) && Object.values(map).every((item) => typeof item === 'string'));
  return typeof draft.templateId === 'string' && Number.isInteger(draft.version) &&
    isStringMap(draft.variables) && isStringMap(draft.editableBlocks) && Boolean(
      draft.selectedOptions && typeof draft.selectedOptions === 'object' && !Array.isArray(draft.selectedOptions) &&
      Object.values(draft.selectedOptions).every((index) => Number.isInteger(index) && index >= 0),
    );
}
