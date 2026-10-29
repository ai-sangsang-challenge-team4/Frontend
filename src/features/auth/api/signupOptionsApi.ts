import { httpSignupOptionsApi } from './httpSignupOptionsApi';
import { mockSignupOptionsApi } from './mockSignupOptionsApi';
import type { SignupOptionsApi } from './signupOptionsApiContract';

// Follows VITE_AUTH_API so the IDs in the signup request match the server that receives it.
const api: SignupOptionsApi = import.meta.env?.VITE_AUTH_API === 'http' ? httpSignupOptionsApi : mockSignupOptionsApi;

export const { searchSchools, listSchoolClasses, listClassStudents } = api;

export { SIGNUP_GRADES } from './signupOptionsApiContract';
export type { SchoolClassQuery, SignupOptionsApi } from './signupOptionsApiContract';
export { httpSignupOptionsApi } from './httpSignupOptionsApi';
