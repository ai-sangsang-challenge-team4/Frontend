import { SIGNUP_GRADES } from './api/signupOptionsApiContract';

// Parent signup form state. IDs come from the signup option APIs (/auth/schools…);
// schoolName and grade only drive the form and are not sent.
export type ChildSignupInfo = {
  schoolId: number;
  schoolName: string;
  grade: number;
  schoolClassId: number;
  studentId: number;
  name: string;
};

export type ChildSignupErrors = Partial<Record<'schoolId' | 'grade' | 'schoolClassId' | 'studentId' | 'name', string>>;

export function createEmptyChildSignupInfo(): ChildSignupInfo {
  return { schoolId: 0, schoolName: '', grade: 0, schoolClassId: 0, studentId: 0, name: '' };
}

function isPositiveId(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

// Lists come from the server, so only "something was picked" is checked here;
// the server rejects IDs that do not belong together (SIGNUP_REFERENCE_NOT_FOUND).
export function validateChildSignupInfo(child: ChildSignupInfo | undefined): ChildSignupErrors {
  const errors: ChildSignupErrors = {};
  if (!isPositiveId(child?.schoolId)) errors.schoolId = '검색 결과에서 학교를 선택해 주세요.';
  if (!child || !(SIGNUP_GRADES as readonly number[]).includes(child.grade)) errors.grade = '학년을 선택해 주세요.';
  if (!isPositiveId(child?.schoolClassId)) errors.schoolClassId = '반을 선택해 주세요.';
  if (!isPositiveId(child?.studentId)) errors.studentId = '번호를 선택해 주세요.';
  if (!child?.name.trim()) errors.name = '자녀 이름을 입력해 주세요.';
  return errors;
}
