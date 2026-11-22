import { useLayoutEffect, useRef } from 'react';

// Only the inbox owns this scroll policy. Composer/tab changes for the same thread
// keep their existing focus/scroll behavior; leaving the inbox restores browser policy.
export function useMessageScrollRestoration(threadId: string | null) {
  const previousThreadId = useRef(threadId);
  const listScroll = useRef({ left: 0, top: 0 });

  useLayoutEffect(() => {
    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    const rememberListScroll = () => {
      if (previousThreadId.current === null) {
        listScroll.current = { left: window.scrollX, top: window.scrollY };
      }
    };
    window.addEventListener('scroll', rememberListScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', rememberListScroll);
      window.history.scrollRestoration = previousRestoration;
    };
  }, []);

  useLayoutEffect(() => {
    if (previousThreadId.current === threadId) return;
    previousThreadId.current = threadId;
    // Run before paint, after the destination DOM exists. Saving on scroll avoids
    // reading a position already clamped by the shorter destination content.
    window.scrollTo({ ...(threadId ? { left: 0, top: 0 } : listScroll.current), behavior: 'instant' });
  }, [threadId]);
}
