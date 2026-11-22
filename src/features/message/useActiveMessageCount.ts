import { useEffect, useState } from 'react';
import { messageApiMode } from './api/teacherInboxApi';
import { countActiveComplaints } from './serverInboxPage';
import { initialTeacherThreads } from './mockThreads';
import { readTeacherParentThreads } from './teacherParentMessages';

function countActiveThreads(teacherUserId: number) {
  return [...readTeacherParentThreads(teacherUserId), ...initialTeacherThreads]
    .filter((thread) => thread.status !== 'complete').length;
}

// Sidebar badge count for pages outside the inbox: the same "진행 중 상담" set the inbox shows by default.
// With the server inbox that includes both OPEN and ANSWERED complaints.
export function useActiveMessageCount(teacherUserId: number, revision = 0) {
  const [count, setCount] = useState(() => messageApiMode === 'http' ? 0 : countActiveThreads(teacherUserId));

  useEffect(() => {
    let controller: AbortController | null = null;
    const refresh = () => {
      if (messageApiMode !== 'http') {
        setCount(countActiveThreads(teacherUserId));
        return;
      }
      controller?.abort();
      const current = new AbortController();
      controller = current;
      countActiveComplaints(current.signal)
        .then((total) => { if (!current.signal.aborted) setCount(total); })
        // The badge is a hint; a failed count keeps the last value.
        .catch(() => undefined);
    };
    refresh();
    window.addEventListener('storage', refresh);
    window.addEventListener('parent-messages-changed', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      controller?.abort();
      window.removeEventListener('storage', refresh);
      window.removeEventListener('parent-messages-changed', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [teacherUserId, revision]);

  return count;
}
