import type { HTMLAttributes, ReactNode } from 'react';
import { classNames } from './classNames';

export type BadgeVariant =
  | 'neutral'
  | 'brand'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'critical';
export type BadgeSize = 'sm' | 'md';

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  size?: BadgeSize;
  variant?: BadgeVariant;
};

export function Badge({
  children,
  className,
  size = 'md',
  variant = 'neutral',
  ...props
}: BadgeProps) {
  return (
    <span
      {...props}
      className={classNames(
        'ui-badge',
        `ui-badge--${variant}`,
        `ui-badge--${size}`,
        className,
      )}
    >
      {children}
    </span>
  );
}

export type StatusChipStatus =
  | 'default'
  | 'pending'
  | 'progress'
  | 'complete'
  | 'attention'
  | 'danger'
  | 'urgent'
  | 'review';

const defaultStatusLabels: Record<StatusChipStatus, string> = {
  default: '일반',
  pending: '상담 전',
  progress: '상담 중',
  complete: '상담 완료',
  attention: '주의',
  danger: '위험',
  urgent: '긴급',
  review: '검토',
};

export type StatusChipProps = HTMLAttributes<HTMLSpanElement> & {
  label?: ReactNode;
  size?: BadgeSize;
  status?: StatusChipStatus;
};

export function StatusChip({
  className,
  label,
  size = 'md',
  status = 'default',
  ...props
}: StatusChipProps) {
  return (
    <span
      {...props}
      className={classNames(
        'ui-status-chip',
        `ui-status-chip--${status}`,
        `ui-status-chip--${size}`,
        className,
      )}
    >
      {label ?? defaultStatusLabels[status]}
    </span>
  );
}
