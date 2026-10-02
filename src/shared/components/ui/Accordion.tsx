import { useState, type ReactNode } from 'react';
import { ChevronDownIcon } from '../teacher-shell/icons';
import { classNames } from './classNames';

export type AccordionItem = {
  content: ReactNode;
  disabled?: boolean;
  id: string;
  title: ReactNode;
};

export type AccordionProps = {
  allowMultiple?: boolean;
  className?: string;
  defaultValue?: string | string[];
  items: AccordionItem[];
  onValueChange?: (openItemIds: string[]) => void;
  value?: string[];
};

function normalizeValue(value?: string | string[]) {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

export function Accordion({
  allowMultiple = false,
  className,
  defaultValue,
  items,
  onValueChange,
  value,
}: AccordionProps) {
  const [internalValue, setInternalValue] = useState(() =>
    normalizeValue(defaultValue),
  );
  const openItemIds = value ?? internalValue;

  const setOpenItemIds = (nextValue: string[]) => {
    if (value === undefined) {
      setInternalValue(nextValue);
    }

    onValueChange?.(nextValue);
  };

  const toggleItem = (item: AccordionItem) => {
    if (item.disabled) {
      return;
    }

    const isOpen = openItemIds.includes(item.id);
    const nextValue = allowMultiple
      ? isOpen
        ? openItemIds.filter((id) => id !== item.id)
        : [...openItemIds, item.id]
      : isOpen
        ? []
        : [item.id];

    setOpenItemIds(nextValue);
  };

  return (
    <div className={classNames('ui-accordion', className)}>
      {items.map((item) => {
        const isOpen = openItemIds.includes(item.id);
        const contentId = `${item.id}-accordion-panel`;
        const triggerId = `${item.id}-accordion-trigger`;

        return (
          <section
            className={classNames(
              'ui-accordion-item',
              isOpen && 'is-open',
              item.disabled && 'is-disabled',
            )}
            key={item.id}
          >
            <h3 className="ui-accordion-heading">
              <button
                aria-controls={contentId}
                aria-expanded={isOpen}
                className="ui-accordion-trigger"
                disabled={item.disabled}
                id={triggerId}
                onClick={() => toggleItem(item)}
                type="button"
              >
                <span>{item.title}</span>
                <ChevronDownIcon className="ui-accordion-icon" />
              </button>
            </h3>
            {isOpen ? (
              <div
                aria-labelledby={triggerId}
                className="ui-accordion-panel"
                id={contentId}
                role="region"
              >
                {item.content}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
