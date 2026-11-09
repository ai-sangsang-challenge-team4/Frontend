import { useEffect, useRef, type RefObject } from 'react';

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
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    // Both dialogs are portalled. Inert siblings block pointer and AT navigation too.
    const background = Array.from(document.body.children)
      .filter((element): element is HTMLElement => element instanceof HTMLElement && !element.contains(dialog))
      .map((element) => ({ element, inert: element.inert }));
    background.forEach(({ element }) => { element.inert = true; });

    const handleKeyDown = (event: KeyboardEvent) => {
      // A nested popup owns Escape before its containing dialog does.
      if (event.defaultPrevented) return;
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
      }
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    dialog.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = previousOverflow;
      background.forEach(({ element, inert }) => { element.inert = inert; });
      document.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true });
    };
  }, [open, dialogRef]);
}
