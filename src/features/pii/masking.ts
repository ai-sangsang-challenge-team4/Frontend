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

export function maskContactInfo(text: string) {
  let count = 0;
  const replace = (label: string) => () => {
    count += 1;
    return label;
  };
  const masked = text
    .replace(RESIDENT_ID, replace('[주민등록번호]'))
    .replace(EMAIL, replace('[이메일]'))
    .replace(PHONE, replace('[전화번호]'));
  return { text: masked, count };
}

export function checkPersonalInfo(text: string): MaskingResult {
  // import.meta.env is undefined outside Vite (Playwright unit tests).
  if (import.meta.env?.DEV) {
    try {
      const settings = JSON.parse(localStorage.getItem('teacher-hub.pii-mock-settings') ?? '{}');
      if (settings?.failMasking === true) return { status: 'failed', text: null, count: null };
    } catch {
      // Invalid development settings do not change the masking rules.
    }
  }
  return { status: 'ready', ...maskContactInfo(text) };
}

export function requireMaskedText(text: string) {
  const result = checkPersonalInfo(text);
  if (result.status === 'failed') throw new MaskingError();
  return result.text;
}
