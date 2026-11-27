export type MaskingResult =
  | { status: 'ready'; text: string; count: number }
  | { status: 'failed'; text: null; count: null };

export class MaskingError extends Error {
  constructor() {
    super('개인정보 마스킹을 완료하지 못했습니다. 내용을 확인한 뒤 다시 시도해 주세요.');
    this.name = 'MaskingError';
  }
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
const NAME_SUFFIX = '이가|이는|이를|이랑|이도|이라고|이라는|입니다|이에요|' +
  '(?:님이?|학생이?|선생님이?|보호자)?' +
  '(?:(?:에게서?|한테서?|께서?|으로|에서|처럼|보다|까지|부터|[이가은는을를의도과와랑로])(?:도|는|만)?)?';

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
        '\\[(?:이름|전화번호|이메일|주민등록번호)\\]|(?<![\\p{L}\\p{M}\\p{N}])(' + known.join('|') +
        ')(?=(?:' + NAME_SUFFIX + ')(?![\\p{L}\\p{M}\\p{N}]))', 'giu',
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
