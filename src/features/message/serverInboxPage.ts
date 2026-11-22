import { teacherInboxApi, type ComplaintListQuery } from './api/teacherInboxApi';

// Keep the server's order and cursor. Closed-only pages must not hide active rows on later pages.
export async function loadTeacherInboxPage(query: ComplaintListQuery, activeOnly: boolean, signal?: AbortSignal) {
  let page = query.page ?? 0;
  while (true) {
    signal?.throwIfAborted();
    const response = await teacherInboxApi.listComplaints({ ...query, page }, signal);
    if (!activeOnly) return response;
    const content = response.content.filter((item) => item.status === 'OPEN' || item.status === 'ANSWERED');
    if (content.length > 0 || !response.hasNext) return { ...response, content };
    page += 1;
  }
}

export async function countActiveComplaints(signal?: AbortSignal) {
  const [open, answered] = await Promise.all([
    teacherInboxApi.listComplaints({ status: 'OPEN' }, signal),
    teacherInboxApi.listComplaints({ status: 'ANSWERED' }, signal),
  ]);
  return open.totalElements + answered.totalElements;
}
