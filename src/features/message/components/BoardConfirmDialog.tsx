import { useEffect, type ReactNode, type SVGProps } from 'react';

export type BoardConfirmDialogAction = {
  disabled?: boolean;
  label: string;
  onClick: () => void;
  tone?: 'danger' | 'primary';
};

export type BoardConfirmDialogProps = {
  actions: BoardConfirmDialogAction[];
  children?: ReactNode;
  descriptionId?: string;
  onClose: () => void;
  open: boolean;
  title: ReactNode;
  titleHidden?: boolean;
  titleId: string;
};

function ConfirmCloseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M6.4 19 5 17.6 10.6 12 5 6.4 6.4 5 12 10.6 17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function BoardConfirmDialog({
  actions,
  children,
  descriptionId,
  onClose,
  open,
  title,
  titleHidden = false,
  titleId,
}: BoardConfirmDialogProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="board-confirm-modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      role="presentation"
    >
      <section
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="board-confirm-modal"
        role="dialog"
      >
        <button
          aria-label="닫기"
          className="board-confirm-modal-close"
          onClick={onClose}
          type="button"
        >
          <ConfirmCloseIcon aria-hidden="true" />
        </button>
        <div className="board-confirm-modal-content">
          <h2
            className={titleHidden ? 'sr-only' : 'board-confirm-modal-title'}
            id={titleId}
          >
            {title}
          </h2>
          {children}
        </div>
        <div className="board-confirm-modal-actions">
          {actions.map((action, index) => {
            const className = [
              'board-confirm-modal-action',
              action.tone ? `board-confirm-modal-action--${action.tone}` : '',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <button
                className={className}
                disabled={action.disabled}
                key={`${action.label}-${index}`}
                onClick={action.onClick}
                type="button"
              >
                {action.label}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
