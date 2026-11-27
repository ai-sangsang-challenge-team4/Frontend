export type MaskingResult =
  | { status: 'ready'; text: string; count: number }
  | { status: 'failed'; text: null; count: null };

export class MaskingError extends Error {
  constructor() {
    super('개인정보 마스킹을 완료하지 못했습니다. 내용을 확인한 뒤 다시 시도해 주세요.');
    this.name = 'MaskingError';
  }
}

const serverMaskingLabels: Readonly<Record<string, string>> = {
  STUDENT_NAME: '학생명',
  THIRD_PARTY_STUDENT_NAME: '제3자 학생명',
  TEACHER_NAME: '교사명',
  ADDITIONAL_NAME: '사용자명',
  STUDENT_ID: '학번',
  TEACHER_ID: '교직원번호',
  PHONE: '전화번호',
  EMAIL: '이메일',
  RESIDENT_ID: '주민등록번호',
  CLASS_STUDENT: '학생정보',
};
const maskingLabels = `\\[(?:이름|개인정보|${Object.values(serverMaskingLabels).join('|')})\\]`;
const maskingLabelPattern = new RegExp(maskingLabels, 'g');

// Analysis evidence can retain the indexed tokens sent to the model.
export function formatServerMaskedText(text: string): string {
  return text.replace(/\[개인정보:([A-Z_]+):\d+\]/g, (_token, category: string) =>
    `[${serverMaskingLabels[category] ?? '개인정보'}]`);
}

export function countMaskingLabels(text: string): number {
  return text.match(maskingLabelPattern)?.length ?? 0;
}

// Covers at least what the backend PiiMaskingServiceImpl masks, in the same order (resident number, email,
// phone), because the server stores the text it receives and shows it to the teacher; its own masking only
// covers the copy sent to the LLM. The phone pattern also accepts "." separators, +82 mobile prefixes other
// than 10, and 050 personal virtual numbers, which the server does not.
const RESIDENT_ID = /(?<!\d)\d{6}[-\s]?[1-8]\d{6}(?!\d)/g;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// Mobile (01x), Seoul (02), regional (031~065), personal virtual (050, 0502~0508), and internet (070) numbers,
// domestic or +82.
const PHONE = /(?<!\d)(?:\+82[-.\s]?(?:1[016789]|2|[3-6][1-5]|50[2-8]?|70)|0(?:1[016789]|2|[3-6][1-5]|50[2-8]?|70))[-.\s]?\d{3,4}[-.\s]?\d{4}(?!\d)/g;

export type KnownNames = readonly (string | undefined)[];

const LABELED_NAME = /(?<![\p{L}\p{N}])((?:이름|성명)[ \t]*[:：][ \t]*)([가-힣]{2,5})(?![\p{L}\p{N}])/gu;
const UNKNOWN_NAME_VALUES = new Set(['없음', '미상', '미정', '모름', '익명', '비공개', '미확인', '해당없음']);
const NAME_PARTICLE_WITH_I = '이(?:가|는|를|랑|도|와|의|에게서?|한테서?|께서?|라고|라는)(?:도|는|만)?';
const NAME_SUFFIX = `${NAME_PARTICLE_WITH_I}|입니다|이에요|라고|` +
  '(?:님이?|학생이?|선생님이?|보호자)?' +
  '(?:(?:에게서?|한테서?|께서?|으로|에서|처럼|보다|까지|부터|[이가은는을를의도과와랑로만])(?:도|는|만)?)?';
const WORD_START = '(?<![\\p{L}\\p{M}\\p{N}])';
const WORD_END = '(?![\\p{L}\\p{M}\\p{N}])';
const GIVEN_NAME_WITH_PARTICLE = new RegExp(`${WORD_START}([가-힣]{2,4})(?=(?:${NAME_PARTICLE_WITH_I})${WORD_END})`, 'gu');
const POSSIBLE_FULL_NAME = new RegExp(`${WORD_START}[가-힣]{3,5}${WORD_END}`, 'gu');
const CLASSMATE_MENTION = new RegExp(
  `${WORD_START}같은[ \\t]+(?:반|학급)[ \\t]+친구(?:인)?[ \\t]+([가-힣]{2,5})(?=(?:${NAME_PARTICLE_WITH_I})${WORD_END})`,
  'gu',
);
const GENERIC_PERSON_WORDS = new Set(['어린', '어린이', '아이', '아동', '사람', '학생', '친구', '동생']);
// Match the compound surnames and minimum given-name length used by the server.
const COMPOUND_KOREAN_SURNAMES = new Set(['남궁', '독고', '동방', '망절', '사공', '서문', '선우', '제갈', '황보']);

export function getStudentGivenName(studentName: string | undefined) {
  const name = studentName?.trim();
  if (!name || !/^[가-힣]{3,5}$/.test(name)) return undefined;
  const surnameLength = COMPOUND_KOREAN_SURNAMES.has(name.slice(0, 2)) ? 2 : 1;
  const givenName = name.slice(surnameLength);
  return givenName.length >= 2 ? givenName : undefined;
}

export function maskDraftPreview(text: string, names: KnownNames) {
  const previewNames = new Set(names);
  const mentionedGivenNames = new Set(Array.from(text.matchAll(GIVEN_NAME_WITH_PARTICLE), (match) => match[1]));
  // Corroborate a given name with an independent full-name mention or an explicit classmate reference.
  for (const fullName of text.match(POSSIBLE_FULL_NAME) ?? []) {
    const givenName = getStudentGivenName(fullName);
    if (givenName && mentionedGivenNames.has(givenName) && !GENERIC_PERSON_WORDS.has(givenName)) {
      previewNames.add(fullName);
      previewNames.add(givenName);
    }
  }
  for (const [, name] of text.matchAll(CLASSMATE_MENTION)) {
    if (!GENERIC_PERSON_WORDS.has(name)) previewNames.add(name);
  }
  return maskContactInfo(text, [...previewNames]);
}

export function maskContactInfo(text: string, names?: KnownNames) {
  let count = 0;
  const replace = (label: string) => () => {
    count += 1;
    return label;
  };
  let masked = text
    .replace(RESIDENT_ID, replace('[주민등록번호]'))
    .replace(EMAIL, replace('[이메일]'))
    .replace(PHONE, replace('[전화번호]'));
  if (names) {
    const maskName = replace('[이름]');
    masked = masked.replace(LABELED_NAME, (match, label: string, name: string) => (
      UNKNOWN_NAME_VALUES.has(name) ? match : label + maskName()
    ));
    const known = [...new Set(names.map((name) => name?.trim()))]
      .filter((name): name is string => Boolean(name))
      .sort((left, right) => right.length - left.length)
      .map((name) => name.replace(/[.*+?^$(){}|[\]\\]/g, '\\$&'));
    if (known.length > 0) {
      // Keep Korean particles and titles attached to the name. Leave existing masking markers intact.
      const pattern = new RegExp(
        `${maskingLabels}|${WORD_START}(${known.join('|')})(?=(?:${NAME_SUFFIX})${WORD_END})`, 'giu',
      );
      masked = masked.replace(pattern, (match, name?: string) => name === undefined ? match : maskName());
    }
  }
  return { text: masked, count };
}

export function checkPersonalInfo(text: string, names?: KnownNames): MaskingResult {
  // import.meta.env is undefined outside Vite (Playwright unit tests).
  if (import.meta.env?.DEV) {
    try {
      const settings = JSON.parse(localStorage.getItem('teacher-hub.pii-mock-settings') ?? '{}');
      if (settings?.failMasking === true) return { status: 'failed', text: null, count: null };
    } catch {
      // Invalid development settings do not change the masking rules.
    }
  }
  return { status: 'ready', ...maskContactInfo(text, names) };
}

export function requireMaskedText(text: string, names?: KnownNames) {
  const result = checkPersonalInfo(text, names);
  if (result.status === 'failed') throw new MaskingError();
  return result.text;
}
