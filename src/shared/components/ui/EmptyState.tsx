import type { ReactNode } from 'react';
import { classNames } from './classNames';

export type EmptyStateProps = {
  action?: ReactNode;
  className?: string;
  description?: ReactNode;
  icon?: ReactNode;
  title: ReactNode;
};

function DefaultEmptyIcon() {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <path
        d="M8 9.5C8 7.567 9.567 6 11.5 6H28.5C30.433 6 32 7.567 32 9.5V30.5C32 32.433 30.433 34 28.5 34H11.5C9.567 34 8 32.433 8 30.5V9.5ZM11.5 8C10.672 8 10 8.672 10 9.5V24H15.2C15.834 24 16.419 24.302 16.787 24.819L18.216 26.825C18.59 27.35 19.195 27.662 19.84 27.662H20.16C20.805 27.662 21.41 27.35 21.784 26.825L23.213 24.819C23.581 24.302 24.166 24 24.8 24H30V9.5C30 8.672 29.328 8 28.5 8H11.5ZM30 26H24.8L23.413 27.947C22.665 28.998 21.455 29.622 20.16 29.622H19.84C18.545 29.622 17.335 28.998 16.587 27.947L15.2 26H10V30.5C10 31.328 10.672 32 11.5 32H28.5C29.328 32 30 31.328 30 30.5V26Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function EmptyState({
  action,
  className,
  description,
  icon,
  title,
}: EmptyStateProps) {
  return (
    <div className={classNames('ui-empty-state', className)}>
      <div className="ui-empty-state-icon">{icon ?? <DefaultEmptyIcon />}</div>
      <div className="ui-empty-state-copy">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="ui-empty-state-action">{action}</div> : null}
    </div>
  );
}
