import { useEffect, useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { classNames } from './classNames';

export type ModalSize = 'sm' | 'md' | 'lg';

export type ModalProps = {
  children: ReactNode;
  className?: string;
  closeOnOverlayClick?: boolean;
  description?: ReactNode;
  footer?: ReactNode;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  size?: ModalSize;
  title: ReactNode;
};

function ModalCloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6.4 19L5 17.6L10.6 12L5 6.4L6.4 5L12 10.6L17.6 5L19 6.4L13.4 12L19 17.6L17.6 19L12 13.4L6.4 19Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function Modal({
  children,
  className,
  closeOnOverlayClick = true,
  description,
  footer,
  onOpenChange,
  open,
  size = 'md',
  title,
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenChange(false);
      }
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onOpenChange, open]);

  if (!open || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      className="ui-modal-overlay"
      onMouseDown={(event) => {
        if (closeOnOverlayClick && event.target === event.currentTarget) {
          onOpenChange(false);
        }
      }}
      role="presentation"
    >
      <section
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className={classNames('ui-modal', `ui-modal--${size}`, className)}
        role="dialog"
      >
        <div className="ui-modal-header">
          <div className="ui-modal-heading">
            <h2 id={titleId}>{title}</h2>
            {description ? (
              <p id={descriptionId}>{description}</p>
            ) : null}
          </div>
          <button
            aria-label="닫기"
            className="ui-modal-close"
            onClick={() => onOpenChange(false)}
            type="button"
          >
            <ModalCloseIcon />
          </button>
        </div>
        <div className="ui-modal-body">{children}</div>
        {footer ? <div className="ui-modal-footer">{footer}</div> : null}
      </section>
    </div>,
    document.body,
  );
}
