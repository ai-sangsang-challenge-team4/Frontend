import {
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { classNames } from './classNames';

export type TabItem = {
  content?: ReactNode;
  disabled?: boolean;
  label: ReactNode;
  value: string;
};

export type TabsProps = {
  ariaLabel: string;
  className?: string;
  defaultValue?: string;
  items: TabItem[];
  onValueChange?: (value: string) => void;
  value?: string;
  variant?: 'line' | 'pill';
};

export function Tabs({
  ariaLabel,
  className,
  defaultValue,
  items,
  onValueChange,
  value,
  variant = 'line',
}: TabsProps) {
  const generatedId = useId();
  const firstEnabledItem = items.find((item) => !item.disabled);
  const [internalValue, setInternalValue] = useState(
    defaultValue ?? firstEnabledItem?.value ?? '',
  );
  const activeValue = value ?? internalValue;
  const activeItem =
    items.find((item) => item.value === activeValue && !item.disabled) ??
    firstEnabledItem;
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const setActiveValue = (nextValue: string) => {
    if (value === undefined) {
      setInternalValue(nextValue);
    }

    onValueChange?.(nextValue);
  };

  const focusTab = (nextValue: string) => {
    setActiveValue(nextValue);
    window.requestAnimationFrame(() => tabRefs.current[nextValue]?.focus());
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentValue: string,
  ) => {
    const enabledItems = items.filter((item) => !item.disabled);
    const currentIndex = enabledItems.findIndex(
      (item) => item.value === currentValue,
    );

    if (currentIndex < 0) {
      return;
    }

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      const nextItem = enabledItems[(currentIndex + 1) % enabledItems.length];
      focusTab(nextItem.value);
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      const nextItem =
        enabledItems[
          (currentIndex - 1 + enabledItems.length) % enabledItems.length
        ];
      focusTab(nextItem.value);
    }

    if (event.key === 'Home') {
      event.preventDefault();
      focusTab(enabledItems[0].value);
    }

    if (event.key === 'End') {
      event.preventDefault();
      focusTab(enabledItems[enabledItems.length - 1].value);
    }
  };

  return (
    <div className={classNames('ui-tabs', `ui-tabs--${variant}`, className)}>
      <div className="ui-tabs-list" role="tablist" aria-label={ariaLabel}>
        {items.map((item) => {
          const isActive = item.value === activeItem?.value;
          const tabId = `${generatedId}-${item.value}-tab`;
          const panelId = `${generatedId}-${item.value}-panel`;

          return (
            <button
              aria-controls={panelId}
              aria-selected={isActive}
              className={classNames('ui-tabs-trigger', isActive && 'is-active')}
              disabled={item.disabled}
              id={tabId}
              key={item.value}
              onClick={() => setActiveValue(item.value)}
              onKeyDown={(event) => handleKeyDown(event, item.value)}
              ref={(node) => {
                tabRefs.current[item.value] = node;
              }}
              role="tab"
              tabIndex={isActive ? 0 : -1}
              type="button"
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {activeItem?.content !== undefined ? (
        <div
          aria-labelledby={`${generatedId}-${activeItem.value}-tab`}
          className="ui-tabs-panel"
          id={`${generatedId}-${activeItem.value}-panel`}
          role="tabpanel"
          tabIndex={0}
        >
          {activeItem.content}
        </div>
      ) : null}
    </div>
  );
}
