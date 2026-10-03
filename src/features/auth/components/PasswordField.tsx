import {
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { classNames } from '../../../shared/components/ui/classNames';
import type { FieldSize } from '../../../shared/components/ui/TextField';

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'> & {
  containerClassName?: string;
  error?: ReactNode;
  fieldSize?: FieldSize;
  helperText?: ReactNode;
  label?: ReactNode;
};

export function PasswordField({
  className,
  containerClassName,
  disabled,
  error,
  fieldSize = 'md',
  helperText,
  id,
  label,
  ...props
}: PasswordFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const helperId = helperText ? `${fieldId}-helper` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const [isVisible, setIsVisible] = useState(false);
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
        'auth-password-field',
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
      <div className="ui-input-shell auth-password-shell">
        <input
          {...inputProps}
          aria-describedby={describedBy || undefined}
          aria-invalid={ariaInvalid ?? (Boolean(error) || undefined)}
          className={classNames('ui-field-control', className)}
          disabled={disabled}
          id={fieldId}
          type={isVisible ? 'text' : 'password'}
        />
        <button
          aria-controls={fieldId}
          aria-label={isVisible ? '비밀번호 숨기기' : '비밀번호 표시하기'}
          aria-pressed={isVisible}
          className="auth-password-toggle"
          disabled={disabled}
          onClick={() => setIsVisible((visible) => !visible)}
          title={isVisible ? '비밀번호 숨기기' : '비밀번호 표시하기'}
          type="button"
        >
          {isVisible ? (
            <EyeOff aria-hidden="true" size={24} />
          ) : (
            <Eye aria-hidden="true" size={24} />
          )}
        </button>
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
