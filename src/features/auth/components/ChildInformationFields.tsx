import { useId } from 'react';
import { Select, TextField } from '../../../shared/components/ui';
import {
  getSignupClasses,
  getSignupGrades,
  getSignupSchool,
  getSignupStudentNumbers,
} from '../api/mockSchoolDirectory';
import type { ChildSignupErrors, ChildSignupInfo } from '../childSignup';
import { SchoolSearchField } from './SchoolSearchField';
import './ChildInformationFields.css';

type ChildInformationFieldsProps = {
  disabled: boolean;
  errors?: ChildSignupErrors;
  value: ChildSignupInfo;
  onChange: (value: ChildSignupInfo) => void;
};

export function ChildInformationFields({ disabled, errors, value, onChange }: ChildInformationFieldsProps) {
  const headingId = useId();
  const noticeId = `${headingId}-notice`;
  const school = getSignupSchool(value.schoolId);
  const grades = getSignupGrades(school);
  const classes = getSignupClasses(value.schoolId, value.grade);
  const studentNumbers = getSignupStudentNumbers(value.schoolId, value.grade, value.classNumber);

  return (
    <fieldset
      aria-describedby={noticeId}
      aria-labelledby={headingId}
      className="auth-fieldset auth-child-information"
      disabled={disabled}
    >
      <legend className="auth-child-information__heading">
        <span className="auth-child-information__title" id={headingId}>
          기본 정보 <span className="auth-required">*</span>
        </span>
        <span className="auth-child-information__notice" id={noticeId}>
          학교·학급 목록은 예시 데이터입니다.
        </span>
      </legend>
      <div className="auth-child-information__fields">
        <SchoolSearchField
          disabled={disabled}
          error={errors?.schoolId}
          onSelect={(schoolId) => {
            if (schoolId !== value.schoolId) {
              onChange({ ...value, schoolId, grade: 0, classNumber: 0, studentNumber: 0 });
            }
          }}
          schoolId={value.schoolId}
        />
        <Select
          aria-required="true"
          containerClassName="auth-child-row"
          disabled={disabled || !school}
          error={errors?.grade}
          fieldSize="lg"
          label="학년"
          name="childGrade"
          onChange={(event) => onChange({
            ...value, grade: Number(event.target.value), classNumber: 0, studentNumber: 0,
          })}
          options={grades.map((grade) => ({ value: String(grade), label: `${grade}학년` }))}
          placeholder="학년을 선택해 주세요."
          value={value.grade || ''}
        />
        <Select
          aria-required="true"
          containerClassName="auth-child-row"
          disabled={disabled || !value.grade}
          error={errors?.classNumber}
          fieldSize="lg"
          label="반"
          name="childClassNumber"
          onChange={(event) => onChange({
            ...value, classNumber: Number(event.target.value), studentNumber: 0,
          })}
          options={classes.map(({ classNumber }) => ({ value: String(classNumber), label: `${classNumber}반` }))}
          placeholder="반을 선택해 주세요."
          value={value.classNumber || ''}
        />
        <Select
          aria-required="true"
          containerClassName="auth-child-row"
          disabled={disabled || !value.classNumber}
          error={errors?.studentNumber}
          fieldSize="lg"
          label="번호"
          name="childStudentNumber"
          onChange={(event) => onChange({ ...value, studentNumber: Number(event.target.value) })}
          options={studentNumbers.map((number) => ({ value: String(number), label: `${number}번` }))}
          placeholder="번호를 선택해 주세요."
          value={value.studentNumber || ''}
        />
        <TextField
          aria-required="true"
          autoComplete="off"
          disabled={disabled}
          error={errors?.name}
          fieldSize="lg"
          label={<span>자녀 이름 <span className="auth-required">*</span></span>}
          name="childName"
          onChange={(event) => onChange({ ...value, name: event.target.value })}
          placeholder="자녀 이름을 입력해 주세요."
          value={value.name}
        />
      </div>
    </fieldset>
  );
}
