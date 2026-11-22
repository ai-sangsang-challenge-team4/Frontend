import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../../../shared/components/ui';
import { useModalFocus } from '../../../shared/components/ui/useModalFocus';

export function DetailSupportDrawer({ title, children, onClose }: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  const [isWide, setIsWide] = useState(() => window.matchMedia('(min-width: 1600px)').matches);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1600px)');
    const update = () => setIsWide(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useModalFocus(!isWide, panelRef, onClose);
  useEffect(() => {
    if (!isWide) return;
    const trigger = document.activeElement as HTMLElement | null;
    panelRef.current?.focus({ preventScroll: true });
    const closeOnEscape = (event: KeyboardEvent) => {
      // A tooltip or confirmation dialog can own Escape first.
      if (event.key === 'Escape' && !event.defaultPrevented && !document.querySelector('[aria-modal="true"], [role="tooltip"]')) {
        event.preventDefault();
        closeRef.current();
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [isWide]);

  return createPortal(
    <div className={`board-support-layer${isWide ? ' is-wide' : ''}`}>
      <section className="board-support-drawer" ref={panelRef} tabIndex={-1}
        role={isWide ? 'region' : 'dialog'} aria-modal={isWide ? undefined : true} aria-labelledby={titleId}>
        <header className="board-support-heading">
          <h2 id={titleId}>{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="상세 정보 닫기">닫기</Button>
        </header>
        <div className="board-support-body">{children}</div>
      </section>
    </div>, document.body,
  );
}
