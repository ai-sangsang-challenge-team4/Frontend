import { useEffect, useRef, type RefObject } from 'react';

type ActiveModal = { dialog: HTMLElement; returnFocus: HTMLElement | null };
const activeModals: ActiveModal[] = [];
const originalInert = new Map<HTMLElement, boolean>();
let originalOverflow: string | null = null;
let originalFocus: HTMLElement | null = null;
let environmentObserver: MutationObserver | null = null;

// Reuse the trigger relationships exposed by popups and Tooltip. Follow links from
// owned portals too, so a tooltip inside a portaled popup belongs to the same modal.
function getModalRoots(dialog: HTMLElement): HTMLElement[] {
  const roots = [dialog];
  for (let index = 0; index < roots.length; index += 1) {
    const root = roots[index];
    const owners = [root, ...Array.from(root.querySelectorAll<HTMLElement>('[aria-controls], [aria-describedby]'))];
    for (const owner of owners) {
      const ids = `${owner.getAttribute('aria-controls') ?? ''} ${owner.getAttribute('aria-describedby') ?? ''}`;
      for (const id of ids.split(/\s+/).filter(Boolean)) {
        const target = document.getElementById(id);
        if (target && !target.contains(dialog) && !roots.some((scope) => scope.contains(target))) roots.push(target);
      }
    }
  }
  return roots;
}

function syncModalEnvironment() {
  const top = activeModals[activeModals.length - 1];
  if (!top) {
    environmentObserver?.disconnect();
    environmentObserver = null;
    originalInert.forEach((inert, element) => { element.inert = inert; });
    originalInert.clear();
    if (originalOverflow !== null) document.body.style.overflow = originalOverflow;
    originalOverflow = null;
    originalFocus = null;
    return;
  }

  const roots = getModalRoots(top.dialog);
  // Keep one original snapshot for the whole modal session, including lower overlays.
  originalInert.forEach((inert, element) => { element.inert = inert; });
  const syncBranch = (element: HTMLElement) => {
    if (!originalInert.has(element)) originalInert.set(element, element.inert);
    const containsOwned = roots.some((root) => element.contains(root));
    element.inert = !containsOwned;
    // A linked description can share a host with background controls. Expose its
    // branch only; keep siblings blocked. Preserve the active overlay's backdrop.
    if (containsOwned && !roots.includes(element) && !element.contains(top.dialog)) {
      for (const child of Array.from(element.children)) {
        if (child instanceof HTMLElement) syncBranch(child);
      }
    }
  };
  for (const element of Array.from(document.body.children)) {
    if (element instanceof HTMLElement) syncBranch(element);
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
      environmentObserver = new MutationObserver(syncModalEnvironment);
      environmentObserver.observe(document.body, {
        childList: true, subtree: true, attributes: true,
        attributeFilter: ['aria-controls', 'aria-describedby'],
      });
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
      const roots = getModalRoots(dialog);
      const candidates = Array.from(new Set(roots.flatMap((root) => [root, ...Array.from(root.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]',
      ))]))).filter((element) => element.tabIndex >= 0 && !element.matches(':disabled') &&
        !element.closest('[inert]') && element.getClientRects().length > 0 &&
        getComputedStyle(element).visibility !== 'hidden')
        .sort((a, b) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
      const focusable = candidates.filter((element) => {
        if (!(element instanceof HTMLInputElement) || element.type !== 'radio' || !element.name) return true;
        const group = candidates.filter((candidate): candidate is HTMLInputElement => (
          candidate instanceof HTMLInputElement && candidate.type === 'radio' &&
          candidate.name === element.name && candidate.form === element.form
        ));
        // An unchecked group enters at either end; once focused it leaves from that member.
        const stop = group.find((radio) => radio.checked) ?? group.find((radio) => radio === document.activeElement)
          ?? (event.shiftKey ? group[group.length - 1] : group[0]);
        return element === stop;
      });
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!first || !last) {
        event.preventDefault();
        dialog.focus({ preventScroll: true });
      } else if (active === dialog || !roots.some((root) => root.contains(active))) {
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
      if (target?.isConnected && !target.closest('[inert]') && (!top || getModalRoots(top.dialog).some((root) => root.contains(target)))) {
        target.focus({ preventScroll: true });
      } else if (top) {
        top.dialog.focus({ preventScroll: true });
      } else if (fallbackFocus?.isConnected && !fallbackFocus.closest('[inert]')) {
        fallbackFocus.focus({ preventScroll: true });
      }
    };
  }, [open, dialogRef]);
}
