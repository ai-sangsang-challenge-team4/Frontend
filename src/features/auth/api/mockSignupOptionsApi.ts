// UI fixtures only, shaped like the backend SignupOptionResponse.
// These schools, classes, and student numbers are examples, not real school records.
import type { SignupOptionResponse } from './authTypes';
import type { SignupOptionsApi } from './signupOptionsApiContract';

type MockSchool = { id: number; name: string; code: string; grades: number[] };

const CLASSES_PER_GRADE = 3;
const STUDENTS_PER_CLASS = 30;

const schools: MockSchool[] = [
  { id: 1, name: '상상초등학교', code: 'MOCK-ELEMENTARY', grades: [1, 2, 3, 4, 5, 6] },
  { id: 2, name: '상상중학교', code: 'MOCK-MIDDLE', grades: [1, 2, 3] },
  { id: 3, name: '상상고등학교', code: 'MOCK-HIGH', grades: [1, 2, 3] },
];

// Deterministic IDs so a selection survives a reload: 1062 = school 1, grade 6, class 2.
function schoolClassId(schoolId: number, grade: number, classNo: number) {
  return schoolId * 1000 + grade * 10 + classNo;
}

function studentId(classId: number, studentNo: number) {
  return classId * 100 + studentNo;
}

function parseSchoolClassId(classId: number) {
  const school = schools.find((entry) => entry.id === Math.floor(classId / 1000));
  const grade = Math.floor((classId % 1000) / 10);
  const classNo = classId % 10;
  if (!school || !school.grades.includes(grade) || classNo < 1 || classNo > CLASSES_PER_GRADE) return null;
  return { school, grade, classNo };
}

function toSchoolOption(school: MockSchool): SignupOptionResponse {
  return {
    type: 'SCHOOL',
    id: school.id,
    displayName: school.name,
    referenceCode: school.code,
    academicYear: null,
    grade: null,
    classNo: null,
  };
}

function resolve<T>(value: T, signal?: AbortSignal) {
  if (signal?.aborted) return Promise.reject(new DOMException('Request aborted', 'AbortError'));
  return Promise.resolve(value);
}

// Mirrors the server's parent check: the student must belong to the class in the selected school.
export function hasMockStudentPlacement(schoolId: number, classId: number, selectedStudentId: number) {
  const placement = parseSchoolClassId(classId);
  const studentNo = selectedStudentId - classId * 100;
  return Boolean(placement && placement.school.id === schoolId &&
    Number.isInteger(studentNo) && studentNo >= 1 && studentNo <= STUDENTS_PER_CLASS);
}

export function hasMockSchool(schoolId: number) {
  return schools.some((school) => school.id === schoolId);
}

export const mockSignupOptionsApi: SignupOptionsApi = {
  searchSchools: (keyword, signal) => {
    const normalized = keyword.replace(/\s/g, '').toLowerCase();
    return resolve(schools
      .filter((school) => school.name.toLowerCase().includes(normalized))
      .map(toSchoolOption), signal);
  },

  listSchoolClasses: (schoolId, query = {}, signal) => {
    const school = schools.find((entry) => entry.id === schoolId);
    const academicYear = query.academicYear ?? new Date().getFullYear();
    const grades = school?.grades.filter((grade) => query.grade === undefined || grade === query.grade) ?? [];
    return resolve(grades.flatMap((grade) => Array.from({ length: CLASSES_PER_GRADE }, (_, index) => ({
      type: 'SCHOOL_CLASS' as const,
      id: schoolClassId(schoolId, grade, index + 1),
      displayName: `${grade}학년 ${index + 1}반`,
      referenceCode: null,
      academicYear,
      grade,
      classNo: index + 1,
    }))), signal);
  },

  listClassStudents: (classId, signal) => resolve(parseSchoolClassId(classId)
    ? Array.from({ length: STUDENTS_PER_CLASS }, (_, index) => ({
      type: 'STUDENT' as const,
      id: studentId(classId, index + 1),
      displayName: `${index + 1}번`,
      referenceCode: String(index + 1),
      academicYear: null,
      grade: null,
      classNo: null,
    }))
    : [], signal),
};
