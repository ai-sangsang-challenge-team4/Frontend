import { useCallback, useEffect, useState } from 'react';
import { readMessageDrafts, readSentMessages } from './messageDraft';
import { findSentSubmission } from './conversation';

function readParentMessages(userId: number) {
  try {
    return {
      messages: readSentMessages(userId).sort((a, b) => (b.updatedAt ?? b.sentAt).localeCompare(a.updatedAt ?? a.sentAt)),
      drafts: readMessageDrafts(userId).filter((draft) => !findSentSubmission(userId, draft)),
      error: null,
    };
  } catch {
    return { messages: [], drafts: [], error: '문의 내역을 불러오지 못했습니다. 다시 시도해 주세요.' };
  }
}

export function useParentMessages(userId: number) {
  const [result, setResult] = useState(() => readParentMessages(userId));
  const refresh = useCallback(() => setResult(readParentMessages(userId)), [userId]);
  useEffect(() => {
    window.addEventListener('storage', refresh);
    window.addEventListener('parent-messages-changed', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('parent-messages-changed', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [refresh]);
  return { ...result, refresh };
}
