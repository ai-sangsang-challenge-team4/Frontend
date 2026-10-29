import type { RiskFactorStatus } from '../../shared/types';
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
    .filter((text) => text.trim());
}

export function detectionConfidence(confidence: number | null | undefined) {
  return typeof confidence === 'number' && Number.isFinite(confidence) && confidence >= 0 && confidence <= 1
    ? `${Math.round(confidence * 100)}%` : '제공되지 않음';
}
