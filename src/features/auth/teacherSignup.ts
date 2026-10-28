import { getSignupSchool } from './api/mockSchoolDirectory';

// Frontend/Mock input; school IDs are examples until the backend contract is agreed.
export type TeacherSignupInfo = {
  schoolId: string;
  employeeNo: string;
};

export function validateTeacherSignupInfo(info: TeacherSignupInfo) {
  const errors: Partial<Record<keyof TeacherSignupInfo, string>> = {};
  if (!getSignupSchool(info.schoolId)) {
    errors.schoolId = '검색 결과에서 소속학교를 선택해 주세요.';
  }
  if (!info.employeeNo?.trim()) {
    errors.employeeNo = '교번을 입력해 주세요.';
  }
  return errors;
}
