import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';
import { classNames } from './classNames';

export type TooltipPlacement = 'top' | 'right' | 'bottom' | 'left';
export type TooltipProps = {
  children: ReactNode;
  className?: string;
  content: ReactNode;
  disabled?: boolean;
  placement?: TooltipPlacement;
};

export function Tooltip({ children, className, content, disabled = false, placement = 'top' }: TooltipProps) {
  const tooltipId = useId();
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const contentRef = useRef<HTMLSpanElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const touchOpen = useRef<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const visible = open && !disabled;
  const show = () => { clearTimeout(closeTimer.current); setOpen(true); };
  const hide = () => { clearTimeout(closeTimer.current); setOpen(false); };
  const scheduleHide = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      if (!rootRef.current?.matches(':hover') && !contentRef.current?.matches(':hover') &&
        !rootRef.current?.contains(document.activeElement)) hide();
    }, 140);
  };

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || disabled) return;
    // Describe the actual control and avoid a second Tab stop around a button.
    const trigger = Array.from(root.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]'))
      .find((element) => element.tabIndex >= 0 && !element.matches(':disabled') &&
        element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden') ?? root;
    if (trigger === root) root.tabIndex = 0;
    const describedBy = trigger.getAttribute('aria-describedby')?.split(/\s+/).filter(Boolean) ?? [];
    if (visible) trigger.setAttribute('aria-describedby', [...new Set([...describedBy, tooltipId])].join(' '));
    return () => {
      const remaining = trigger.getAttribute('aria-describedby')?.split(/\s+/).filter((id) => id && id !== tooltipId) ?? [];
      if (remaining.length) trigger.setAttribute('aria-describedby', remaining.join(' '));
      else trigger.removeAttribute('aria-describedby');
      if (trigger === root) root.removeAttribute('tabindex');
    };
  }, [children, disabled, tooltipId, visible]);

  useLayoutEffect(() => {
    if (!visible) return;
    const position = () => {
      const trigger = rootRef.current?.getBoundingClientRect();
      const tooltip = contentRef.current;
      if (!trigger || !tooltip) return;
      const { width, height } = tooltip.getBoundingClientRect();
      const gap = 8;
      let left = trigger.left + (trigger.width - width) / 2;
      let top = trigger.top - height - gap;
      if (placement === 'bottom' || (placement === 'top' && top < gap)) top = trigger.bottom + gap;
      if (placement === 'left' || placement === 'right') {
        left = placement === 'left' ? trigger.left - width - gap : trigger.right + gap;
        top = trigger.top + (trigger.height - height) / 2;
      }
      tooltip.style.left = `${Math.max(16, Math.min(left, window.innerWidth - width - 16))}px`;
      tooltip.style.top = `${Math.max(16, Math.min(top, window.innerHeight - height - 16))}px`;
    };
    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => {
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
    };
  }, [visible, placement, content]);

  useEffect(() => {
    if (!visible) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false); }
    };
    const outside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node) && !contentRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', dismiss, true);
    document.addEventListener('pointerdown', outside);
    return () => {
      document.removeEventListener('keydown', dismiss, true);
      document.removeEventListener('pointerdown', outside);
    };
  }, [visible]);
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  if (disabled) return <>{children}</>;
  return (
    <span className={classNames('ui-tooltip', `ui-tooltip--${placement}`, className)} ref={rootRef}
      onMouseEnter={show} onMouseLeave={scheduleHide}
      onFocus={show} onBlur={scheduleHide}
      onPointerDown={(event) => { touchOpen.current = event.pointerType === 'touch' ? visible : null; }}
      onClick={() => { if (touchOpen.current === null) show(); else setOpen(!touchOpen.current); }}>
      {children}
      {visible ? createPortal(
        <span className="ui-tooltip-content" id={tooltipId} ref={contentRef} role="tooltip"
          onMouseEnter={show} onMouseLeave={scheduleHide}>{content}</span>, document.body,
      ) : null}
    </span>
  );
}

/** Optional explanations only. Safety, errors and permissions remain inline. */
export function InformationTooltip({ label, content }: { label: string; content: ReactNode }) {
  return <Tooltip content={content}><button aria-label={label} className="ui-information-trigger" type="button">
    <Info aria-hidden="true" size={18} />
  </button></Tooltip>;
}
