import { useEffect, useRef, type RefObject } from 'react';

type ActiveModal = { dialog: HTMLElement; returnFocus: HTMLElement | null };
const activeModals: ActiveModal[] = [];
const originalInert = new Map<HTMLElement, boolean>();
let originalOverflow: string | null = null;
let originalFocus: HTMLElement | null = null;

function syncModalEnvironment() {
  const top = activeModals[activeModals.length - 1];
  if (!top) {
    originalInert.forEach((inert, element) => { element.inert = inert; });
    originalInert.clear();
    if (originalOverflow !== null) document.body.style.overflow = originalOverflow;
    originalOverflow = null;
    originalFocus = null;
    return;
  }

  // Keep one original snapshot for the whole modal session, including lower overlays.
  for (const element of Array.from(document.body.children)) {
    if (!(element instanceof HTMLElement)) continue;
    if (!originalInert.has(element)) originalInert.set(element, element.inert);
    element.inert = !element.contains(top.dialog);
  }
  document.body.style.overflow = 'hidden';
}

/** Shared by both dialog presentations; callbacks must not restart focus capture. */
export function useModalFocus(
  open: boolean,
  dialogRef: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!open || !dialogRef.current) return;
    const dialog = dialogRef.current;
    const entry: ActiveModal = { dialog, returnFocus: document.activeElement as HTMLElement | null };
    if (!activeModals.length) {
      originalOverflow = document.body.style.overflow;
      originalFocus = entry.returnFocus;
    }
    activeModals.push(entry);
    syncModalEnvironment();

    const handleKeyDown = (event: KeyboardEvent) => {
      // A nested popup owns Escape before its containing dialog does.
      if (event.defaultPrevented || activeModals[activeModals.length - 1] !== entry) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]',
      )).filter((element) => element.tabIndex >= 0 && !element.matches(':disabled') &&
        !element.closest('[inert]') && element.getClientRects().length > 0 &&
        getComputedStyle(element).visibility !== 'hidden');
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!first || !last) {
        event.preventDefault();
        dialog.focus({ preventScroll: true });
      } else if (active === dialog || !dialog.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (active && !focusable.includes(active as HTMLElement)) {
        // A roving-focus option is not a Tab stop. Continue in DOM order, or wrap.
        const candidates = focusable.filter((element) => active.compareDocumentPosition(element) &
          (event.shiftKey ? Node.DOCUMENT_POSITION_PRECEDING : Node.DOCUMENT_POSITION_FOLLOWING));
        const target = event.shiftKey ? candidates[candidates.length - 1] ?? last : candidates[0] ?? first;
        event.preventDefault();
        target.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    dialog.focus({ preventScroll: true });
    return () => {
      const wasTop = activeModals[activeModals.length - 1] === entry;
      const fallbackFocus = originalFocus;
      activeModals.splice(activeModals.indexOf(entry), 1);
      syncModalEnvironment();
      document.removeEventListener('keydown', handleKeyDown);
      if (!wasTop) return;
      const top = activeModals[activeModals.length - 1];
      const target = entry.returnFocus;
      if (target?.isConnected && !target.closest('[inert]') && (!top || top.dialog.contains(target))) {
        target.focus({ preventScroll: true });
      } else if (top) {
        top.dialog.focus({ preventScroll: true });
      } else if (fallbackFocus?.isConnected && !fallbackFocus.closest('[inert]')) {
        fallbackFocus.focus({ preventScroll: true });
      }
    };
  }, [open, dialogRef]);
}
