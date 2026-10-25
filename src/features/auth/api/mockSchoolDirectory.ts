// UI fixtures only. Replace with a school/class directory adapter once the backend supports it.
// These schools, classes, and student numbers are examples, not real school records.
export type SignupSchool = {
  id: string;
  name: string;
  level: 'ELEMENTARY' | 'MIDDLE' | 'HIGH';
};

type SignupClass = {
  classNumber: number;
  studentNumbers: number[];
};

const schools: SignupSchool[] = [
  { id: 'mock-elementary', name: '상상초등학교', level: 'ELEMENTARY' },
  { id: 'mock-middle', name: '상상중학교', level: 'MIDDLE' },
  { id: 'mock-high', name: '상상고등학교', level: 'HIGH' },
];

const schoolClasses = new Map<string, SignupClass[]>(
  schools.flatMap((school) => getSignupGrades(school).map((grade) => [
    `${school.id}:${grade}`,
    Array.from({ length: 3 }, (_, index) => ({
      classNumber: index + 1,
      studentNumbers: Array.from({ length: 30 }, (_, studentIndex) => studentIndex + 1),
    })),
  ] as const)),
);

export function searchSignupSchools(query: string) {
  const normalizedQuery = query.replace(/\s/g, '').toLowerCase();
  return schools.filter((school) => school.name.toLowerCase().includes(normalizedQuery));
}

export function getSignupSchool(schoolId: string) {
  return schools.find((school) => school.id === schoolId);
}

export function getSignupGrades(school: SignupSchool | undefined) {
  if (!school) return [];
  return Array.from({ length: school.level === 'ELEMENTARY' ? 6 : 3 }, (_, index) => index + 1);
}

export function getSignupClasses(schoolId: string, grade: number) {
  return schoolClasses.get(`${schoolId}:${grade}`) ?? [];
}

export function getSignupStudentNumbers(schoolId: string, grade: number, classNumber: number) {
  return getSignupClasses(schoolId, grade)
    .find((schoolClass) => schoolClass.classNumber === classNumber)?.studentNumbers ?? [];
}
