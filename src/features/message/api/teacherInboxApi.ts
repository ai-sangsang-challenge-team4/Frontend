import { httpTeacherInboxApi } from './httpTeacherInboxApi';

// VITE_MESSAGE_API=http reads the inbox from the backend; it needs VITE_AUTH_API=http for a real JWT.
// Anything else keeps the browser-local inbox (mock threads and the parent-message bridge), which has no
// server DTOs, so there is no DTO-level mock adapter.
export const messageApiMode: 'mock' | 'http' =
  import.meta.env?.VITE_MESSAGE_API === 'http' ? 'http' : 'mock';

export const teacherInboxApi = httpTeacherInboxApi;

export { httpTeacherInboxApi } from './httpTeacherInboxApi';
export type { TeacherInboxApi } from './teacherInboxApiContract';
export * from './teacherInboxTypes';
