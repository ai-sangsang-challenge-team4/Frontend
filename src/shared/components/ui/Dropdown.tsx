import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ChevronDownIcon } from '../teacher-shell/icons';
import { classNames } from './classNames';

export type DropdownOption = {
  description?: ReactNode;
  disabled?: boolean;
  label: ReactNode;
  value: string;
};

export type DropdownProps = {
  ariaLabel?: string;
  className?: string;
  defaultValue?: string;
  disabled?: boolean;
  menuLabel?: string;
  onValueChange?: (value: string, option: DropdownOption) => void;
  options: DropdownOption[];
  placeholder?: ReactNode;
  value?: string;
};

export function Dropdown({
  ariaLabel,
  className,
  defaultValue,
  disabled = false,
  menuLabel,
  onValueChange,
  options,
  placeholder = '선택',
  value,
}: DropdownProps) {
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const initialEdge = useRef<'first' | 'last'>('first');
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(defaultValue ?? '');
  const selectedValue = value ?? internalValue;
  const selectedOption = options.find((option) => option.value === selectedValue);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const enabled = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]:not(:disabled)');
    const selected = menuRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]:not(:disabled)');
    const target = selected ?? (initialEdge.current === 'last' ? enabled?.[enabled.length - 1] : enabled?.[0]);
    (target ?? menuRef.current)?.focus();

    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isOpen]);

  const handleSelect = (option: DropdownOption) => {
    if (option.disabled) {
      return;
    }

    if (value === undefined) {
      setInternalValue(option.value);
    }

    setIsOpen(false);
    triggerRef.current?.focus();
    onValueChange?.(option.value, option);
  };

  return (
    <div
      className={classNames(
        'ui-dropdown',
        isOpen && 'is-open',
        disabled && 'is-disabled',
        className,
      )}
      ref={rootRef}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && isOpen) {
          event.preventDefault();
          event.stopPropagation();
          setIsOpen(false);
          triggerRef.current?.focus();
        }
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        if (!isOpen) {
          initialEdge.current = event.key === 'ArrowUp' || event.key === 'End' ? 'last' : 'first';
          setIsOpen(true);
          return;
        }
        const enabled = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]:not(:disabled)') ?? []);
        if (!enabled.length) return;
        const index = enabled.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? enabled.length - 1 :
          (index + (event.key === 'ArrowUp' ? -1 : 1) + enabled.length) % enabled.length;
        enabled[next].focus();
      }}
    >
      <button
        aria-controls={isOpen ? menuId : undefined}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className="ui-dropdown-button"
        disabled={disabled}
        onClick={() => { initialEdge.current = 'first'; setIsOpen((current) => !current); }}
        ref={triggerRef}
        type="button"
      >
        <span className="ui-dropdown-value">
          {selectedOption?.label ?? placeholder}
        </span>
        <ChevronDownIcon className="ui-dropdown-icon" />
      </button>
      {isOpen ? (
        <div
          aria-label={menuLabel ?? ariaLabel}
          className="ui-dropdown-menu"
          id={menuId}
          ref={menuRef}
          role="listbox"
          tabIndex={-1}
        >
          {options.map((option) => (
            <button
              aria-selected={option.value === selectedValue}
              className={classNames(
                'ui-dropdown-option',
                option.value === selectedValue && 'is-selected',
              )}
              disabled={option.disabled}
              key={option.value}
              onClick={() => handleSelect(option)}
              role="option"
              tabIndex={-1}
              type="button"
            >
              <span>{option.label}</span>
              {option.description ? (
                <small>{option.description}</small>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
