import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { classNames } from './classNames';

export type FieldSize = 'sm' | 'md' | 'lg';

type FieldMetaProps = {
  containerClassName?: string;
  error?: ReactNode;
  helperText?: ReactNode;
  label?: ReactNode;
};

export type TextFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'size'
> &
  FieldMetaProps & {
    fieldSize?: FieldSize;
    leadingIcon?: ReactNode;
    trailingIcon?: ReactNode;
  };

export function TextField({
  className,
  containerClassName,
  disabled,
  error,
  fieldSize = 'md',
  helperText,
  id,
  label,
  leadingIcon,
  trailingIcon,
  ...props
}: TextFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const helperId = helperText ? `${fieldId}-helper` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const {
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
    ...inputProps
  } = props;
  const describedBy = [ariaDescribedBy, errorId, helperId]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classNames(
        'ui-field',
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
      <div className="ui-input-shell">
        {leadingIcon ? (
          <span className="ui-field-icon" aria-hidden="true">
            {leadingIcon}
          </span>
        ) : null}
        <input
          {...inputProps}
          aria-describedby={describedBy || undefined}
          aria-invalid={ariaInvalid ?? (Boolean(error) || undefined)}
          className={classNames('ui-field-control', className)}
          disabled={disabled}
          id={fieldId}
        />
        {trailingIcon ? (
          <span className="ui-field-icon" aria-hidden="true">
            {trailingIcon}
          </span>
        ) : null}
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

export type TextareaFieldProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  'size'
> &
  FieldMetaProps & {
    fieldSize?: FieldSize;
  };

export function TextareaField({
  className,
  containerClassName,
  disabled,
  error,
  fieldSize = 'md',
  helperText,
  id,
  label,
  rows = 4,
  ...props
}: TextareaFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const helperId = helperText ? `${fieldId}-helper` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const {
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
    ...textareaProps
  } = props;
  const describedBy = [ariaDescribedBy, errorId, helperId]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classNames(
        'ui-field',
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
      <textarea
        {...textareaProps}
        aria-describedby={describedBy || undefined}
        aria-invalid={ariaInvalid ?? (Boolean(error) || undefined)}
        className={classNames('ui-field-control', 'ui-textarea-control', className)}
        disabled={disabled}
        id={fieldId}
        rows={rows}
      />
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
