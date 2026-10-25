import {
  getSignupClasses,
  getSignupGrades,
  getSignupSchool,
  getSignupStudentNumbers,
} from './api/mockSchoolDirectory';

// Frontend/Mock input; this is not an agreed backend DTO.
export type ChildSignupInfo = {
  schoolId: string;
  grade: number;
  classNumber: number;
  studentNumber: number;
  name: string;
};

export type ChildSignupErrors = Partial<Record<keyof ChildSignupInfo, string>>;

export function createEmptyChildSignupInfo(): ChildSignupInfo {
  return { schoolId: '', grade: 0, classNumber: 0, studentNumber: 0, name: '' };
}

export function validateChildSignupInfo(child: ChildSignupInfo | undefined): ChildSignupErrors {
  const errors: ChildSignupErrors = {};
  const school = getSignupSchool(child?.schoolId ?? '');
  if (!school) errors.schoolId = '검색 결과에서 학교를 선택해 주세요.';
  if (!child || !getSignupGrades(school).includes(child.grade)) {
    errors.grade = '학년을 선택해 주세요.';
  }
  if (!child || !getSignupClasses(child.schoolId, child.grade)
    .some((schoolClass) => schoolClass.classNumber === child.classNumber)) {
    errors.classNumber = '반을 선택해 주세요.';
  }
  if (!child || !getSignupStudentNumbers(child.schoolId, child.grade, child.classNumber)
    .includes(child.studentNumber)) {
    errors.studentNumber = '번호를 선택해 주세요.';
  }
  if (!child?.name.trim()) errors.name = '자녀 이름을 입력해 주세요.';
  return errors;
}
