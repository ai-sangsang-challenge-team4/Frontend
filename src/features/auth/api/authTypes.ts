import type { UserRole } from '../../../shared/types';

// Shapes in this file follow the backend auth DTOs (auth/dto, user/dto).
// Do not add fields the backend does not define.

// POST /auth/login
export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginResponse = {
  accessToken: string;
  tokenType: string;
  // Seconds until the access token expires.
  expiresIn: number;
  user: UserInfoResponse;
};

// GET /users/me, LoginResponse.user
export type UserInfoResponse = {
  userId: number;
  email: string;
  name: string;
  role: UserRole;
};

// POST /auth/signup (201)
export type SignupRequest = {
  schoolId: number;
  email: string;
  // 8~100 characters on the server.
  password: string;
  // The account holder's own name. A teacher's must match the staff roster.
  name: string;
  role: Exclude<UserRole, 'ADMIN'>;
  // Required for TEACHER.
  employeeNo: string | null;
  // Required for PARENT.
  schoolClassId: number | null;
  studentId: number | null;
  // Required for PARENT; must match the student's name on record.
  studentName: string | null;
};

export type SignupResponse = {
  userId: number;
  email: string;
  name: string;
  role: UserRole;
  // LocalDateTime without a time zone.
  createdAt: string;
};

export type SignupOptionType = 'SCHOOL' | 'SCHOOL_CLASS' | 'STUDENT';

// GET /auth/schools, /auth/schools/{schoolId}/classes, /auth/classes/{schoolClassId}/students
// SCHOOL: referenceCode = school code, academicYear/grade/classNo null.
// SCHOOL_CLASS: referenceCode null, academicYear/grade/classNo set.
// STUDENT: referenceCode = student number, academicYear/grade/classNo null.
export type SignupOptionResponse = {
  type: SignupOptionType;
  id: number;
  displayName: string;
  referenceCode: string | null;
  academicYear: number | null;
  grade: number | null;
  classNo: number | null;
};
