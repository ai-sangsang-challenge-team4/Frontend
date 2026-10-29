import type {
  DetectedFactor,
  DetectedFactorCode,
  EscalationComplaintSnapshot,
  EscalationStateResponse,
} from '../escalation/escalationTypes';
import type { RiskLevel } from '../../shared/types';
import { maskContactInfo } from '../pii/masking';
import { defaultRiskScore, getThreadRiskLevel, getVisibleRiskFactors, systemRiskTone } from './messageRules';
import type { BoardThread, RiskScore, SystemRiskLevel } from './types';

// Same enum, different casing: the inbox uses lowercase levels, the API uppercase.
export const apiRiskLevel: Record<SystemRiskLevel, RiskLevel> = {
  low: 'LOW',
  medium: 'MEDIUM',
  high: 'HIGH',
  emergency: 'EMERGENCY',
};

export const systemRiskLevelFromApi: Record<RiskLevel, SystemRiskLevel> = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  EMERGENCY: 'emergency',
};

// Applies the server's emergency review state (the admin's decision and the safety lock) to the inbox
// thread. The thread keeps the last state it applied, so a state is applied once and later teacher
// reviews are not reverted. Mock inbox threads are not persisted, so after a reload the server state
// is applied again.
// - APPLIED: the approved score becomes the teacher's review, so the slider no longer resets to 7
//   and a locked thread no longer asks for the teacher's own review first.
// - Lock: follows the server; only the designated reviewer lifts it.
// Returns the same thread when nothing changed.
export function syncThreadWithEmergencyReview(thread: BoardThread, state: EscalationStateResponse): BoardThread {
  const analysis = thread.analysis;
  if (!analysis || state.emergencyReviewRequestId === null || !state.riskReviewStatus) return thread;
  const known = analysis.emergencyReview;
  const isKnownRequest = known?.requestId === state.emergencyReviewRequestId;
  if (isKnownRequest && known.status === state.riskReviewStatus && known.safetyLock === state.safetyLock) {
    return thread;
  }

  const applyLevel = state.riskReviewStatus === 'APPLIED' && (!isKnownRequest || known.status !== 'APPLIED') &&
    state.currentRiskLevel !== null && state.currentRiskScore !== null;
  const level = applyLevel ? systemRiskLevelFromApi[state.currentRiskLevel!] : undefined;
  return {
    ...thread,
    analysis: {
      ...analysis,
      emergencyReview: {
        requestId: state.emergencyReviewRequestId,
        status: state.riskReviewStatus,
        safetyLock: state.safetyLock,
      },
      safetyLock: state.safetyLock,
      ...(level ? { teacherReviewedRiskLevel: level, teacherRiskScore: state.currentRiskScore as RiskScore } : {}),
    },
    ...(level ? { risk: systemRiskTone[level], riskReviewRequired: false } : {}),
  };
}

// The admin share section appears where the risk stage guide recommends it.
// Whether the button is enabled is decided by the server's currentRiskLevel (EMERGENCY only).
export function canShareWithAdmin(thread: BoardThread) {
  const level = getThreadRiskLevel(thread);
  return level === 'high' || level === 'emergency';
}

// Inbox classification codes that have a backend tag; other mock factors fall back to a placeholder.
const mockFactorCode: Record<string, DetectedFactorCode> = {
  EMOTIONAL_EXPRESSION: 'PROFANITY',
  PERSONAL_ATTACK: 'INSULT',
  THREAT: 'THREAT',
  LEGAL_ADMINISTRATIVE_ACTION: 'LEGAL',
  PUBLIC_DISCLOSURE_THREAT: 'EXPOSURE',
  REPETITION: 'REPEAT',
  UNREASONABLE_DEMAND: 'UNFAIR_REQUEST',
  PERSONAL_INFORMATION_RISK: 'PRIVACY',
};

// Mock stand-in for the complaint record the server already holds. Never sent over HTTP.
export function createEscalationSnapshot(thread: BoardThread): EscalationComplaintSnapshot {
  const deliveredMessage = thread.replies.find((reply) => reply.authorRole === 'parent')?.content ?? thread.latestMessage;
  const level = getThreadRiskLevel(thread);
  const parentMessage = {
    senderName: thread.parentName,
    senderRole: 'PARENT' as const,
    sentAt: thread.latestAt,
    summarized: false,
  };
  const original = thread.originalMessage?.trim();

  return {
    detectedFactors: getVisibleRiskFactors(thread).map((factor): DetectedFactor => ({
      // The admin screen does not read `code`; the placeholder only satisfies the response shape.
      code: mockFactorCode[factor.id] ?? 'UNFAIR_REQUEST',
      evidence: factor.evidence,
      name: factor.name,
      reason: factor.rationale,
    })),
    maskedMessages: [{ ...parentMessage, content: maskContactInfo(deliveredMessage).text, messageId: `${thread.id}-masked` }],
    originalMessages: original ? [{ ...parentMessage, content: original, messageId: `${thread.id}-original` }] : [],
    riskLevel: apiRiskLevel[level],
    riskScore: thread.analysis?.teacherRiskScore ?? defaultRiskScore[level],
    title: thread.title,
  };
}
