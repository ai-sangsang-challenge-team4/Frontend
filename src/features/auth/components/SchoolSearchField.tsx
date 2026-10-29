import { useCallback, useId, useState } from 'react';
import { Search } from 'lucide-react';
import { getApiErrorMessage, useApiRequest } from '../../../shared/api';
import { TextField } from '../../../shared/components/ui';
import { authApiMode, searchSchools, type SignupOptionResponse } from '../api/authApi';

const SEARCH_DEBOUNCE_MS = 150;

export type SelectedSchool = Pick<SignupOptionResponse, 'id' | 'displayName'>;

type SchoolSearchFieldProps = {
  disabled?: boolean;
  error?: string;
  label?: string;
  name?: string;
  placeholder?: string;
  // id 0 means nothing is selected; displayName restores the query when the field remounts.
  school: SelectedSchool;
  onSelect: (school: SelectedSchool) => void;
};

function waitForTyping(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, SEARCH_DEBOUNCE_MS);
    signal.addEventListener('abort', () => {
      window.clearTimeout(timer);
      reject(new DOMException('Request aborted', 'AbortError'));
    }, { once: true });
  });
}

export function SchoolSearchField({
  disabled,
  error,
  label = '학교',
  name = 'childSchool',
  placeholder = '자녀가 재학 중인 학교를 검색해 주세요.',
  school,
  onSelect,
}: SchoolSearchFieldProps) {
  const listId = useId();
  const [query, setQuery] = useState(school.displayName);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const expanded = isOpen && !disabled;
  const request = useCallback(
    async (signal: AbortSignal) => {
      if (!expanded) return null;
      await waitForTyping(signal);
      return { query, schools: await searchSchools(query, signal) };
    },
    [expanded, query],
  );
  const { data, error: searchError, isLoading } = useApiRequest(request);
  // Results for an older query are never offered for selection.
  const schools = data?.query === query ? data.schools : [];
  const isSearching = isLoading || data?.query !== query;
  const activeSchool = schools[activeIndex];

  const selectSchool = (selected: SignupOptionResponse) => {
    setQuery(selected.displayName);
    setIsOpen(false);
    setActiveIndex(-1);
    onSelect({ id: selected.id, displayName: selected.displayName });
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
          if (school.id) onSelect({ id: 0, displayName: '' });
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
          <ul aria-busy={isSearching} aria-label="학교 검색 결과" id={listId} role="listbox">
            {schools.map((option, index) => (
              <li
                aria-selected={option.id === school.id}
                className={index === activeIndex ? 'is-active' : undefined}
                id={`${listId}-${option.id}`}
                key={option.id}
                onClick={() => {
                  selectSchool(option);
                }}
                onPointerDown={(event) => event.preventDefault()}
                role="option"
              >
                {option.displayName}
                {authApiMode === 'mock' ? <> <small>예시 학교</small></> : null}
              </li>
            ))}
          </ul>
          {searchError ? (
            <p role="alert">{getApiErrorMessage(searchError, '학교를 검색하지 못했습니다. 다시 시도해 주세요.')}</p>
          ) : isSearching ? (
            schools.length === 0 ? <p role="status">학교를 검색하고 있습니다.</p> : null
          ) : schools.length === 0 ? (
            <p role="status">검색 결과가 없습니다. 다른 학교 이름으로 검색해 주세요.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
