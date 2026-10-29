import { useId, useState } from 'react';
import { Search } from 'lucide-react';
import { TextField } from '../../../shared/components/ui';
import { getSignupSchool, searchSignupSchools, type SignupSchool } from '../api/mockSchoolDirectory';

type SchoolSearchFieldProps = {
  disabled?: boolean;
  error?: string;
  label?: string;
  name?: string;
  placeholder?: string;
  schoolId: string;
  onSelect: (schoolId: string) => void;
};

export function SchoolSearchField({
  disabled,
  error,
  label = '학교',
  name = 'childSchool',
  placeholder = '자녀가 재학 중인 학교를 검색해 주세요.',
  schoolId,
  onSelect,
}: SchoolSearchFieldProps) {
  const listId = useId();
  const [query, setQuery] = useState(() => getSignupSchool(schoolId)?.name ?? '');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const schools = searchSignupSchools(query);
  const expanded = isOpen && !disabled;
  const activeSchool = schools[activeIndex];

  const selectSchool = (school: SignupSchool) => {
    setQuery(school.name);
    setIsOpen(false);
    setActiveIndex(-1);
    onSelect(school.id);
  };

  return (
    <div
      className="auth-school-search"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsOpen(false);
          setActiveIndex(-1);
        }
      }}
    >
      <TextField
        aria-activedescendant={expanded && activeSchool ? `${listId}-${activeSchool.id}` : undefined}
        aria-autocomplete="list"
        aria-controls={expanded ? listId : undefined}
        aria-expanded={expanded}
        aria-required="true"
        autoComplete="off"
        containerClassName="auth-child-row"
        disabled={disabled}
        error={error}
        fieldSize="lg"
        label={label}
        name={name}
        onChange={(event) => {
          setQuery(event.target.value);
          setIsOpen(true);
          setActiveIndex(-1);
          // Typing a school name alone is not a selection.
          if (schoolId) onSelect('');
        }}
        onClick={() => setIsOpen(true)}
        onFocus={() => setIsOpen(true)}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setIsOpen(true);
            const direction = event.key === 'ArrowDown' ? 1 : -1;
            setActiveIndex((index) => {
              if (!schools.length) return -1;
              if (index < 0) return direction > 0 ? 0 : schools.length - 1;
              return (index + direction + schools.length) % schools.length;
            });
          } else if (event.key === 'Enter' && expanded) {
            event.preventDefault();
            if (activeSchool) selectSchool(activeSchool);
          } else if (event.key === 'Escape') {
            event.preventDefault();
            setIsOpen(false);
            setActiveIndex(-1);
          }
        }}
        placeholder={placeholder}
        role="combobox"
        trailingIcon={<Search size={18} />}
        value={query}
      />
      {expanded ? (
        <div className="auth-school-search__results">
          <ul aria-label="학교 검색 결과" id={listId} role="listbox">
            {schools.map((school, index) => (
              <li
                aria-selected={school.id === schoolId}
                className={index === activeIndex ? 'is-active' : undefined}
                id={`${listId}-${school.id}`}
                key={school.id}
                onClick={() => {
                  selectSchool(school);
                }}
                onPointerDown={(event) => event.preventDefault()}
                role="option"
              >
                {school.name} <small>예시 학교</small>
              </li>
            ))}
          </ul>
          {schools.length === 0 ? (
            <p role="status">검색 결과가 없습니다. 다른 학교 이름으로 검색해 주세요.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
