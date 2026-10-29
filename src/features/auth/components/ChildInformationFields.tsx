import { useCallback, useId } from 'react';
import { getApiErrorMessage, useApiRequest, type ApiError } from '../../../shared/api';
import { Select, TextField } from '../../../shared/components/ui';
import { authApiMode, listClassStudents, listSchoolClasses, SIGNUP_GRADES } from '../api/authApi';
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
  const { grade, schoolClassId, schoolId } = value;
  // The class list is filtered by the grade query; options come from the response's grade/classNo.
  const loadClasses = useCallback(
    (signal: AbortSignal) => schoolId && grade
      ? listSchoolClasses(schoolId, { grade }, signal)
      : Promise.resolve([]),
    [grade, schoolId],
  );
  const loadStudents = useCallback(
    (signal: AbortSignal) => schoolClassId ? listClassStudents(schoolClassId, signal) : Promise.resolve([]),
    [schoolClassId],
  );
  const classes = useApiRequest(loadClasses);
  const students = useApiRequest(loadStudents);
  // useApiRequest keeps the previous data on failure; those IDs belong to the previous grade or class.
  const classOptions = (classes.error ? [] : classes.data ?? []).map((option) => ({
    value: String(option.id),
    label: option.classNo === null ? option.displayName : `${option.classNo}반`,
  }));
  const studentOptions = (students.error ? [] : students.data ?? []).map((option) => ({
    value: String(option.id),
    label: option.displayName,
  }));

  return (
    <fieldset
      aria-describedby={authApiMode === 'mock' ? noticeId : undefined}
      aria-labelledby={headingId}
      className="auth-fieldset auth-child-information"
      disabled={disabled}
    >
      <legend className="auth-child-information__heading">
        <span className="auth-child-information__title" id={headingId}>
          기본 정보 <span className="auth-required">*</span>
        </span>
        {authApiMode === 'mock' ? (
          <span className="auth-child-information__notice" id={noticeId}>
            학교·학급 목록은 예시 데이터입니다.
          </span>
        ) : null}
      </legend>
      <div className="auth-child-information__fields">
        <SchoolSearchField
          disabled={disabled}
          error={errors?.schoolId}
          name="childSchool"
          onSelect={(school) => {
            if (school.id !== value.schoolId) {
              onChange({
                ...value,
                schoolId: school.id,
                schoolName: school.displayName,
                grade: 0,
                schoolClassId: 0,
                studentId: 0,
              });
            }
          }}
          placeholder="자녀가 재학 중인 학교를 검색해 주세요."
          school={{ id: value.schoolId, displayName: value.schoolName }}
        />
        <Select
          aria-required="true"
          containerClassName="auth-child-row"
          disabled={disabled || !value.schoolId}
          error={errors?.grade}
          fieldSize="lg"
          label="학년"
          name="childGrade"
          onChange={(event) => onChange({
            ...value, grade: Number(event.target.value), schoolClassId: 0, studentId: 0,
          })}
          options={SIGNUP_GRADES.map((option) => ({ value: String(option), label: `${option}학년` }))}
          placeholder="학년을 선택해 주세요."
          value={value.grade || ''}
        />
        <Select
          aria-required="true"
          containerClassName="auth-child-row"
          disabled={disabled || !value.grade || classes.isLoading}
          error={errors?.schoolClassId ?? getOptionsMessage(value.grade > 0, classes, '반')}
          fieldSize="lg"
          label="반"
          name="childClassNumber"
          onChange={(event) => onChange({
            ...value, schoolClassId: Number(event.target.value), studentId: 0,
          })}
          options={classOptions}
          placeholder={value.grade && classes.isLoading ? '반 목록을 불러오고 있습니다.' : '반을 선택해 주세요.'}
          value={value.schoolClassId || ''}
        />
        <Select
          aria-required="true"
          containerClassName="auth-child-row"
          disabled={disabled || !value.schoolClassId || students.isLoading}
          error={errors?.studentId ?? getOptionsMessage(value.schoolClassId > 0, students, '번호')}
          fieldSize="lg"
          label="번호"
          name="childStudentNumber"
          onChange={(event) => onChange({ ...value, studentId: Number(event.target.value) })}
          options={studentOptions}
          placeholder={value.schoolClassId && students.isLoading ? '번호 목록을 불러오고 있습니다.' : '번호를 선택해 주세요.'}
          value={value.studentId || ''}
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

function getOptionsMessage(
  isRequested: boolean,
  state: { data: unknown[] | null; error: ApiError | null; isLoading: boolean },
  label: '반' | '번호',
) {
  if (!isRequested || state.isLoading) return undefined;
  if (state.error) return getApiErrorMessage(state.error, `${label} 목록을 불러오지 못했습니다.`);
  return state.data?.length === 0 ? `선택할 수 있는 ${label === '반' ? '반이' : '번호가'} 없습니다.` : undefined;
}
