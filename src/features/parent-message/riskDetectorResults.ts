import type { RiskFactorStatus } from '../../shared/types';
import { formatServerMaskedText } from '../pii/masking';
import type { RiskDetection } from './api/parentComplaintTypes';

export function detectionState(state: RiskFactorStatus | undefined, detected?: boolean): RiskFactorStatus {
  if (state !== undefined) {
    return ['PRESENT', 'ABSENT', 'BOUNDARY', 'UNKNOWN'].includes(state) ? state : 'UNKNOWN';
  }
  return detected === true ? 'PRESENT' : detected === false ? 'ABSENT' : 'UNKNOWN';
}

export function detectionEvidence(detection: RiskDetection | null): string[] {
  if (!detection) return [];
  return (detection.evidenceSpans ? detection.evidenceSpans.map((span) => span.text) : detection.evidences ?? [])
    .filter((text) => text.trim())
    .map(formatServerMaskedText);
}

export function detectionConfidence(confidence: number | null | undefined) {
  return typeof confidence === 'number' && Number.isFinite(confidence) && confidence >= 0 && confidence <= 1
    ? `${Math.round(confidence * 100)}%` : '제공되지 않음';
}

export function detectionSeverity(result: RiskDetection | null) {
  if (result?.severity != null && [0, 1, 2, 3].includes(result.severity)) {
    return ['해당 없음', '경미', '보통', '심각'][result.severity];
  }
  const state = detectionState(result?.state, result?.detected);
  return state === 'BOUNDARY' ? '경계 사례' : state === 'UNKNOWN' ? '판단 정보 부족' : '심각도 정보 없음';
}
