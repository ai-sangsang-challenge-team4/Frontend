import { useEffect, useState } from 'react';
import { initialTeacherThreads } from './mockThreads';
import { readTeacherParentThreads } from './teacherParentMessages';

function countActiveThreads(teacherUserId: number) {
  return [...readTeacherParentThreads(teacherUserId), ...initialTeacherThreads]
    .filter((thread) => thread.status !== 'complete').length;
}

// Sidebar badge count for pages outside the inbox: the same "진행 중 상담" set the inbox shows by default.
export function useActiveMessageCount(teacherUserId: number) {
  const [count, setCount] = useState(() => countActiveThreads(teacherUserId));

  useEffect(() => {
    const refresh = () => setCount(countActiveThreads(teacherUserId));
    refresh();
    window.addEventListener('storage', refresh);
    window.addEventListener('parent-messages-changed', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('parent-messages-changed', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [teacherUserId]);

  return count;
}
