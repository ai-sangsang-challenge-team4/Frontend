import type { DetectedFactor, DetectedFactorCode, EscalationComplaintSnapshot } from '../escalation/escalationTypes';
import type { RiskLevel } from '../../shared/types';
import { maskContactInfo } from '../pii/masking';
import { defaultRiskScore, getThreadRiskLevel, getVisibleRiskFactors } from './messageRules';
import type { BoardThread, SystemRiskLevel } from './types';

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
