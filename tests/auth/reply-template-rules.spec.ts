import { expect, test } from '@playwright/test';
import { initialTeacherThreads } from '../../src/features/message/mockThreads';
import {
  changeReplyTemplateDraft,
  createReplyTemplateDraft,
  formatConsultationDateTime,
  getReplyTemplate,
  isConsultationDateTime,
  renderReplyTemplate,
  validateReplyTemplate,
} from '../../src/features/message/replyTemplates';

const thread = initialTeacherThreads.find((item) => item.id === 'thread-004')!;
const template = getReplyTemplate('tpl-student-observation')!;
const teacherName = '조예인';

test('고정 문장을 제거하거나 순서를 바꾼 전송 본문은 거부한다', () => {
  let draft = createReplyTemplateDraft(template, thread, teacherName);
  draft = changeReplyTemplateDraft(template, draft, { type: 'option', blockId: 'next-step', index: 1 });
  const text = renderReplyTemplate(template, thread, teacherName, draft);
  expect(validateReplyTemplate(template, draft, thread, teacherName, text)).toEqual([]);
  for (const tampered of ['임의 답변', text.split('\n\n').reverse().join('\n\n'), text.replace('감사합니다.', '')]) {
    expect(validateReplyTemplate(template, draft, thread, teacherName, tampered)).toContain('예시의 고정 문장이 변경되었습니다. 예시를 다시 적용해 주세요.');
  }
  expect(changeReplyTemplateDraft(template, draft, { type: 'text', blockId: 'principle', value: '변조' })).toBe(draft);
  expect(changeReplyTemplateDraft(template, draft, { type: 'variable', key: 'studentName', value: '변조' })).toBe(draft);
});

test('선택하지 않은 안내의 빈칸은 제외하고 잘못된 선택·길이는 거부한다', () => {
  let draft = createReplyTemplateDraft(template, thread, teacherName);
  let text = renderReplyTemplate(template, thread, teacherName, draft);
  expect(validateReplyTemplate(template, draft, thread, teacherName, text)).toContain('상담 날짜와 시간을 선택해 주세요.');
  draft = changeReplyTemplateDraft(template, draft, { type: 'option', blockId: 'next-step', index: 1 });
  text = renderReplyTemplate(template, thread, teacherName, draft);
  expect(validateReplyTemplate(template, draft, thread, teacherName, text)).toEqual([]);

  const invalidOption = { ...draft, selectedOptions: { 'next-step': 99 } };
  expect(validateReplyTemplate(template, invalidOption, thread, teacherName, renderReplyTemplate(template, thread, teacherName, invalidOption))).toContain('마지막 안내를 하나 골라 주세요.');
  const oversized = { ...draft, editableBlocks: { acknowledge: '가'.repeat(151) } };
  expect(validateReplyTemplate(template, oversized, thread, teacherName, renderReplyTemplate(template, thread, teacherName, oversized))).toContain('직접 고칠 문장은 150자 이내로 입력해 주세요.');
});

test('비활성·구버전 전송을 거부하고 같은 예시의 새 버전에 입력을 옮긴다', () => {
  let draft = createReplyTemplateDraft(template, thread, teacherName);
  draft = changeReplyTemplateDraft(template, draft, { type: 'variable', key: 'parentTitle', value: '수아' });
  draft = changeReplyTemplateDraft(template, draft, { type: 'variable', key: 'consultationSlot', value: '2026-10-26T16:00' });
  draft = changeReplyTemplateDraft(template, draft, { type: 'text', blockId: 'acknowledge', value: '확인한 뒤 다시 안내드리겠습니다.' });
  const text = renderReplyTemplate(template, thread, teacherName, draft);
  expect(validateReplyTemplate({ ...template, status: 'INACTIVE' }, draft, thread, teacherName, text).length).toBeGreaterThan(0);
  const nextVersion = { ...template, version: template.version + 1 };
  expect(validateReplyTemplate(nextVersion, draft, thread, teacherName, text).length).toBeGreaterThan(0);
  const migrated = createReplyTemplateDraft(nextVersion, thread, teacherName, draft);
  expect(migrated.variables).toEqual(draft.variables);
  expect(migrated.editableBlocks).toEqual(draft.editableBlocks);
  expect(validateReplyTemplate(nextVersion, migrated, thread, teacherName, renderReplyTemplate(nextVersion, thread, teacherName, migrated))).toEqual([]);
});

test('상담 날짜의 유효성을 검사하고 선택한 한국 시간으로 답변을 만든다', () => {
  expect(isConsultationDateTime('2028-02-29T23:59')).toBe(true);
  expect(formatConsultationDateTime('2026-10-26T16:05')).toBe('2026. 10. 26. 오후 04:05');
  expect(formatConsultationDateTime('2026-10-26T00:05')).toBe('2026. 10. 26. 오전 12:05');
  for (const value of ['', '월요일 오후 4시', '2026-10-26', '2026-02-29T16:00', '2026-04-31T16:00', '2026-13-01T16:00', '2026-10-26T24:00', '2026-10-26T16:60']) {
    expect(isConsultationDateTime(value)).toBe(false);
    const draft = createReplyTemplateDraft(template, thread, teacherName);
    draft.variables.consultationSlot = value;
    const text = renderReplyTemplate(template, thread, teacherName, draft);
    expect(validateReplyTemplate(template, draft, thread, teacherName, text)).toContain('상담 날짜와 시간을 선택해 주세요.');
    draft.selectedOptions['next-step'] = 1;
    expect(validateReplyTemplate(template, draft, thread, teacherName, renderReplyTemplate(template, thread, teacherName, draft))).toEqual([]);
  }
});
