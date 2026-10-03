import {
  useId,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { ChevronDownIcon } from '../teacher-shell/icons';
import { classNames } from './classNames';
import type { FieldSize } from './TextField';

export type SelectOption = {
  disabled?: boolean;
  label: ReactNode;
  value: string;
};

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> & {
  containerClassName?: string;
  error?: ReactNode;
  fieldSize?: FieldSize;
  helperText?: ReactNode;
  label?: ReactNode;
  options: SelectOption[];
  placeholder?: string;
};

export function Select({
  className,
  containerClassName,
  disabled,
  error,
  fieldSize = 'md',
  helperText,
  id,
  label,
  options,
  placeholder,
  ...props
}: SelectProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const helperId = helperText ? `${fieldId}-helper` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const {
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
    ...selectProps
  } = props;
  const describedBy = [ariaDescribedBy, errorId, helperId]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classNames(
        'ui-field',
        'ui-select-field',
        `ui-field--${fieldSize}`,
        disabled && 'is-disabled',
        Boolean(error) && 'is-invalid',
        containerClassName,
      )}
    >
      {label ? (
        <label className="ui-field-label" htmlFor={fieldId}>
          {label}
        </label>
      ) : null}
      <div className="ui-select-shell">
        <select
          {...selectProps}
          aria-describedby={describedBy || undefined}
          aria-invalid={ariaInvalid ?? (Boolean(error) || undefined)}
          className={classNames('ui-field-control', 'ui-select-control', className)}
          disabled={disabled}
          id={fieldId}
        >
          {placeholder ? (
            <option disabled value="">
              {placeholder}
            </option>
          ) : null}
          {options.map((option) => (
            <option
              disabled={option.disabled}
              key={option.value}
              value={option.value}
            >
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="ui-select-icon" />
      </div>
      {error ? (
        <p className="ui-field-message ui-field-error" id={errorId}>
          {error}
        </p>
      ) : helperText ? (
        <p className="ui-field-message" id={helperId}>
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
