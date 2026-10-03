import { useId, type ReactNode } from 'react';
import { classNames } from './classNames';

export type TooltipPlacement = 'top' | 'right' | 'bottom' | 'left';

export type TooltipProps = {
  children: ReactNode;
  className?: string;
  content: ReactNode;
  disabled?: boolean;
  placement?: TooltipPlacement;
};

export function Tooltip({
  children,
  className,
  content,
  disabled = false,
  placement = 'top',
}: TooltipProps) {
  const tooltipId = useId();

  if (disabled) {
    return <>{children}</>;
  }

  return (
    <span
      aria-describedby={tooltipId}
      className={classNames(
        'ui-tooltip',
        `ui-tooltip--${placement}`,
        className,
      )}
      tabIndex={0}
    >
      {children}
      <span className="ui-tooltip-content" id={tooltipId} role="tooltip">
        {content}
      </span>
    </span>
  );
}
