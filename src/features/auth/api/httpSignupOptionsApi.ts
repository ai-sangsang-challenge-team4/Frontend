import { apiClient } from '../../../shared/api';
import type { SignupOptionResponse } from './authTypes';
import type { SignupOptionsApi } from './signupOptionsApiContract';

// Public endpoints (permitAll), so no access token is attached.
export const httpSignupOptionsApi: SignupOptionsApi = {
  searchSchools: (keyword, signal) =>
    apiClient.get<SignupOptionResponse[]>('/auth/schools', {
      auth: false,
      query: { keyword: keyword.trim() || undefined },
      signal,
    }),

  listSchoolClasses: (schoolId, query, signal) =>
    apiClient.get<SignupOptionResponse[]>(`/auth/schools/${schoolId}/classes`, {
      auth: false,
      query: { academicYear: query?.academicYear, grade: query?.grade },
      signal,
    }),

  listClassStudents: (schoolClassId, signal) =>
    apiClient.get<SignupOptionResponse[]>(`/auth/classes/${schoolClassId}/students`, {
      auth: false,
      signal,
    }),
};
