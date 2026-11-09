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
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
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


    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  });

  useEffect(() => {
    if (isOpen) contentRef.current?.focus({ preventScroll: true });
  }, [isOpen]);

  return (
    <div
      className={classNames(
        'ui-popover',
        `ui-popover--${placement}`,
        isOpen && 'is-open',
        className,
      )}
      ref={rootRef}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && isOpen) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          triggerRef.current?.focus();
        }
      }}
    >
      <button
        aria-controls={isOpen ? contentId : undefined}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={ariaLabel}
        className={classNames('ui-popover-trigger', triggerClassName)}
        disabled={disabled}
        onClick={() => setOpen(!isOpen)}
        ref={triggerRef}
        type="button"
      >
        {trigger}
      </button>
      {isOpen ? (
        <div aria-label={ariaLabel} className="ui-popover-content" id={contentId} ref={contentRef} role="dialog" tabIndex={-1}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
