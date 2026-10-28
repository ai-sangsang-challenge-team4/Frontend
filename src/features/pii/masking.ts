export type MaskingResult =
  | { status: 'ready'; text: string; count: number }
  | { status: 'failed'; text: null; count: null };

export class MaskingError extends Error {
  constructor() {
    super('개인정보 마스킹을 완료하지 못했습니다. 내용을 확인한 뒤 다시 시도해 주세요.');
    this.name = 'MaskingError';
  }
}

// Local preview supports mobile numbers and email addresses until the PII API is connected.
export function maskContactInfo(text: string) {
  let count = 0;
  const masked = text
    .replace(/(?:\b0|\+82[-.\s]?)1[016789][-.\s]?\d{3,4}[-.\s]?\d{4}\b/g, () => {
      count += 1;
      return '[전화번호]';
    })
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, () => {
      count += 1;
      return '[이메일]';
    });
  return { text: masked, count };
}

export function checkPersonalInfo(text: string): MaskingResult {
  if (import.meta.env.DEV) {
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
