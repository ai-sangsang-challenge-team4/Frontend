import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { classNames } from './classNames';

export type PopoverPlacement =
  | 'top'
  | 'top-start'
  | 'top-end'
  | 'bottom'
  | 'bottom-start'
  | 'bottom-end';

export type PopoverProps = {
  ariaLabel?: string;
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
  disabled?: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  placement?: PopoverPlacement;
  trigger: ReactNode;
  triggerClassName?: string;
};

export function Popover({
  ariaLabel,
  children,
  className,
  defaultOpen = false,
  disabled = false,
  onOpenChange,
  open,
  placement = 'bottom-start',
  trigger,
  triggerClassName,
}: PopoverProps) {
  const contentId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = open ?? internalOpen;

  const setOpen = (nextOpen: boolean) => {
    if (open === undefined) {
      setInternalOpen(nextOpen);
    }

    onOpenChange?.(nextOpen);
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  });

  return (
    <div
      className={classNames(
        'ui-popover',
        `ui-popover--${placement}`,
        isOpen && 'is-open',
        className,
      )}
      ref={rootRef}
    >
      <button
        aria-controls={isOpen ? contentId : undefined}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={ariaLabel}
        className={classNames('ui-popover-trigger', triggerClassName)}
        disabled={disabled}
        onClick={() => setOpen(!isOpen)}
        type="button"
      >
        {trigger}
      </button>
      {isOpen ? (
        <div className="ui-popover-content" id={contentId} role="dialog">
          {children}
        </div>
      ) : null}
    </div>
  );
}
