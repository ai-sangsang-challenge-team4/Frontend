import { httpParentComplaintApi } from './httpParentComplaintApi';

// Shares VITE_MESSAGE_API with the teacher inbox: http sends the parent's new inquiry to the backend
// (it needs VITE_AUTH_API=http for a real JWT). Anything else keeps the browser-local flow in
// parentMessageApi.ts (mock analysis, local sent messages), which has no server DTOs, so there is no
// DTO-level mock adapter.
export { messageApiMode as parentMessageApiMode } from '../../message/api/teacherInboxApi';

export const parentComplaintApi = httpParentComplaintApi;

export { httpParentComplaintApi } from './httpParentComplaintApi';
export type { ParentComplaintApi } from './parentComplaintApiContract';
export * from './parentComplaintTypes';
