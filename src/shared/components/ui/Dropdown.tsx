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
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
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
    >
      <button
        aria-controls={isOpen ? menuId : undefined}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className="ui-dropdown-button"
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <span className="ui-dropdown-value">
          {selectedOption?.label ?? placeholder}
        </span>
        <ChevronDownIcon className="ui-dropdown-icon" />
      </button>
      {isOpen ? (
        <div
          aria-label={menuLabel}
          className="ui-dropdown-menu"
          id={menuId}
          role="listbox"
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
