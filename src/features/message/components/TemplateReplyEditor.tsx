import { Badge, Button, Dropdown } from '../../../shared/components/ui';
import {
  findCautionExpressions,
  getReplyTemplate,
  isConsultationDateTime,
  templateBlockText,
  templateVariableLabels,
  templateVariableValue,
  type ReplyTemplate,
  type ReplyTemplateChange,
  type ReplyTemplateDraft,
} from '../replyTemplates';
import type { BoardThread } from '../types';

type TemplateReplyEditorProps = {
  disabled: boolean;
  draft?: ReplyTemplateDraft;
  onApply: (templateId: string) => void;
  onChange: (change: ReplyTemplateChange) => void;
  teacherName: string;
  templates: ReplyTemplate[];
  thread: BoardThread;
};

export function TemplateReplyEditor({ disabled, draft, onApply, onChange, teacherName, templates, thread }: TemplateReplyEditorProps) {
  const template = getReplyTemplate(draft?.templateId);
  const variableInput = (key: string, suffix = '') => {
    const isDateTime = key === 'consultationSlot';
    const value = draft?.variables[key] ?? '';
    const invalidDateTime = isDateTime && Boolean(value) && !isConsultationDateTime(value);
    return <input
      aria-label={templateVariableLabels[key] ?? key}
      aria-invalid={invalidDateTime || undefined}
      className={`board-template-variable${isDateTime ? ' board-template-datetime' : ''}`}
      disabled={disabled}
      key={`${key}${suffix}`}
      lang={isDateTime ? 'ko-KR' : undefined}
      maxLength={80}
      onChange={(event) => onChange({ type: 'variable', key, value: event.target.value })}
      onClick={isDateTime ? (event) => {
        const input = event.currentTarget;
        try { input.showPicker?.(); } catch { input.focus(); }
      } : undefined}
      placeholder={templateVariableLabels[key]}
      required
      step={isDateTime ? 60 : undefined}
      type={isDateTime ? 'datetime-local' : 'text'}
      value={invalidDateTime ? '' : value}
    />;
  };
  const renderText = (text: string) => text.split(/(\{\{\w+\}\})/g).map((part, index) => {
    const variable = part.match(/^\{\{(\w+)\}\}$/)?.[1];
    if (!variable || !draft) return part;
    if (variable === 'parentTitle' || variable === 'consultationSlot') return variableInput(variable, String(index));
    return <span key={index}>{templateVariableValue(variable, thread, teacherName, draft)}</span>;
  });

  return (
    <div className="board-template-editor">
      <div className="board-template-toolbar">
        {templates.length > 0 ? (
          <Dropdown
            ariaLabel="답장 예시 선택"
            className="board-template-select"
            disabled={disabled && !draft}
            menuLabel="답장 예시"
            onValueChange={onApply}
            options={templates.map((candidate, index) => ({
              value: candidate.templateId,
              label: `${candidate.title}${index === 0 ? ' · 추천' : ''}`,
              description: candidate.description,
            }))}
            placeholder="답장 예시를 선택해 주세요"
            value={draft?.templateId ?? ''}
          />
        ) : null}
        {template && !template.approved ? <Badge size="sm" variant="neutral">예시 문구 · 확정 전</Badge> : null}
      </div>
      <p className="board-template-notice">입력란과 선택 항목만 수정할 수 있습니다. 나머지 문장은 그대로 전송됩니다.</p>
      {template && draft ? (
        <>
          <div aria-label="답장 예시 편집" className="board-template-body" role="group">
            {template.blocks.map((block) => {
              if (block.mode === 'EDITABLE') {
                const value = draft.editableBlocks[block.blockId] ?? '';
                const cautions = findCautionExpressions(value);
                return (
                  <div className="board-template-editable" key={block.blockId}>
                    <textarea
                      aria-label="직접 고칠 문장"
                      disabled={disabled}
                      maxLength={block.maxLength ?? 150}
                      onChange={(event) => onChange({ type: 'text', blockId: block.blockId, value: event.target.value })}
                      required
                      rows={3}
                      value={value}
                    />
                    <div className="board-template-editable-footer">
                      <span>이 문장은 직접 고칠 수 있어요</span>
                      <span>{value.length} / {block.maxLength ?? 150}</span>
                    </div>
                    {cautions.length > 0 ? (
                      <div className="board-template-caution" role="status">
                        <p>{cautions.map((word) => `“${word}”`).join(', ')}는 약속처럼 들릴 수 있어요.</p>
                        {cautions.includes('반드시') ? (
                          <Button disabled={disabled} onClick={() => onChange({ type: 'text', blockId: block.blockId, value: value.split('반드시').join('다시') })} size="sm" variant="outline">‘다시’로 바꾸기</Button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              }
              if (block.mode === 'SELECT_ONE') {
                return (
                  <fieldset className="board-template-options" disabled={disabled} key={block.blockId}>
                    <legend>마지막 안내를 골라 주세요</legend>
                    {block.options?.map((option, index) => {
                      const selected = draft.selectedOptions[block.blockId] === index;
                      const variables = [...option.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]);
                      return (
                        <div className={`board-template-option${selected ? ' is-selected' : ''}`} key={index}>
                          <label>
                            <input checked={selected} name={`template-${thread.id}-${block.blockId}`} onChange={() => onChange({ type: 'option', blockId: block.blockId, index })} type="radio" />
                            <span>{option.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => templateVariableValue(key, thread, teacherName, draft) || `[${templateVariableLabels[key] ?? key}]`)}</span>
                          </label>
                          {selected ? variables.filter((key) => key === 'parentTitle' || key === 'consultationSlot').map((key) => (
                            <label className="board-template-option-variable" key={key}><span>{templateVariableLabels[key]}</span>{variableInput(key)}</label>
                          )) : null}
                        </div>
                      );
                    })}
                  </fieldset>
                );
              }
              return <p className="board-template-sentence" key={block.blockId}>{block.mode === 'VARIABLE_ONLY' ? renderText(templateBlockText(block, draft)) : templateBlockText(block, draft)}</p>;
            })}
          </div>
        </>
      ) : <p>답장 예시를 골라 필요한 내용을 채워 주세요.</p>}
    </div>
  );
}
