import type { RiskFactorStatus, RiskTagCode } from '../../shared/types/risk';

// These are classification results supplied by analysis, not client-side predictions.
export type RiskClassification = {
  code: RiskTagCode;
  status: RiskFactorStatus;
  rationale?: string;
  evidenceSpan?: string | null;
};

export const riskCategories = [
  { code: 'EMOTIONAL_EXPRESSION', label: '감정적 표현' },
  { code: 'PERSONAL_ATTACK', label: '인신공격' },
  { code: 'THREAT', label: '위협' },
  { code: 'LEGAL_ADMINISTRATIVE_ACTION', label: '법적·행정적 조치' },
  { code: 'PUBLIC_DISCLOSURE_THREAT', label: '공개·유포 위협' },
  { code: 'REPETITION', label: '반복성' },
  { code: 'UNREASONABLE_DEMAND', label: '무리한 요구' },
  { code: 'PERSONAL_INFORMATION_RISK', label: '개인정보 위험' },
] as const satisfies ReadonlyArray<{ code: RiskTagCode; label: string }>;

export const classificationStatusLabel: Record<RiskFactorStatus, string> = {
  PRESENT: '탐지',
  ABSENT: '미탐지',
  BOUNDARY: '경계',
  UNKNOWN: '미확인',
};

export function getRiskClassifications(results?: RiskClassification[]) {
  return riskCategories.map(({ code, label }) => {
    const matches = Array.isArray(results) ? results.filter((result) => result?.code === code) : [];
    const result = matches.length === 1 ? matches[0] : undefined;
    // Missing, duplicate, or invalid results must never be interpreted as ABSENT.
    const status = result && Object.prototype.hasOwnProperty.call(classificationStatusLabel, result.status)
      ? result.status : 'UNKNOWN';
    return {
      code, label, status,
      rationale: typeof result?.rationale === 'string' ? result.rationale : undefined,
      evidenceSpan: typeof result?.evidenceSpan === 'string' ? result.evidenceSpan : undefined,
    };
  });
}
