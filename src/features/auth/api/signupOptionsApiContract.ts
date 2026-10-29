import type { SignupOptionResponse } from './authTypes';

export type SchoolClassQuery = {
  // The server uses the current year when omitted.
  academicYear?: number;
  // 1~6 on the server.
  grade?: number;
};

export type SignupOptionsApi = {
  searchSchools: (keyword: string, signal?: AbortSignal) => Promise<SignupOptionResponse[]>;
  listSchoolClasses: (
    schoolId: number,
    query?: SchoolClassQuery,
    signal?: AbortSignal,
  ) => Promise<SignupOptionResponse[]>;
  listClassStudents: (schoolClassId: number, signal?: AbortSignal) => Promise<SignupOptionResponse[]>;
};

// SchoolClassQuery.grade range accepted by the server (@Min(1) @Max(6)).
export const SIGNUP_GRADES = [1, 2, 3, 4, 5, 6] as const;
