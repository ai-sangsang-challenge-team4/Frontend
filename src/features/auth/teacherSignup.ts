// Teacher signup form state. schoolId comes from GET /auth/schools; the server matches the school,
// staff number (employeeNo), and name against the staff roster.
export type TeacherSignupInfo = {
  schoolId: number;
  employeeNo: string;
};

// The school list comes from the server, so only "a school was picked" is checked here.
export function validateTeacherSignupInfo(info: TeacherSignupInfo) {
  const errors: Partial<Record<keyof TeacherSignupInfo, string>> = {};
  if (!Number.isSafeInteger(info.schoolId) || info.schoolId <= 0) {
    errors.schoolId = '검색 결과에서 소속학교를 선택해 주세요.';
  }
  if (!info.employeeNo?.trim()) {
    errors.employeeNo = '교번을 입력해 주세요.';
  }
  return errors;
}
