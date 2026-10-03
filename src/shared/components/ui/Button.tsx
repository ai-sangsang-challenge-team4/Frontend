import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { NavLink, type NavLinkProps } from 'react-router-dom';
import { classNames } from './classNames';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  fullWidth?: boolean;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

export function Button({
  children,
  className,
  disabled,
  fullWidth = false,
  isLoading = false,
  leftIcon,
  rightIcon,
  size = 'md',
  type = 'button',
  variant = 'primary',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      aria-busy={isLoading || undefined}
      className={classNames(
        'ui-button',
        `ui-button--${variant}`,
        `ui-button--${size}`,
        fullWidth && 'ui-button--full',
        isLoading && 'is-loading',
        className,
      )}
      disabled={disabled || isLoading}
      type={type}
    >
      {isLoading ? (
        <span className="ui-button-spinner" aria-hidden="true" />
      ) : leftIcon ? (
        <span className="ui-button-icon" aria-hidden="true">
          {leftIcon}
        </span>
      ) : null}
      <span className="ui-button-label">{children}</span>
      {!isLoading && rightIcon ? (
        <span className="ui-button-icon" aria-hidden="true">
          {rightIcon}
        </span>
      ) : null}
    </button>
  );
}

export type ButtonLinkProps = Omit<NavLinkProps, 'children' | 'className'> &
  Pick<ButtonProps, 'children' | 'className' | 'fullWidth' | 'size' | 'variant'>;

export function ButtonLink({
  children,
  className,
  fullWidth = false,
  size = 'md',
  variant = 'primary',
  ...props
}: ButtonLinkProps) {
  return (
    <NavLink
      {...props}
      className={classNames(
        'ui-button',
        `ui-button--${variant}`,
        `ui-button--${size}`,
        fullWidth && 'ui-button--full',
        className,
      )}
    >
      <span className="ui-button-label">{children}</span>
    </NavLink>
  );
}
