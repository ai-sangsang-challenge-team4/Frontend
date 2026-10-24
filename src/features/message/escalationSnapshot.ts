import type { EscalationComplaintSnapshot } from '../escalation/escalationTypes';
import type { RiskLevel } from '../../shared/types';
import { maskContactInfo } from '../parent-message/parentMessageTypes';
import { getBufferedSummaryText, getThreadRiskLevel, getVisibleRiskFactors } from './messageRules';
import type { BoardThread, SystemRiskLevel } from './types';

const apiRiskLevel: Record<SystemRiskLevel, RiskLevel> = {
  low: 'LOW',
  medium: 'MEDIUM',
  high: 'HIGH',
  emergency: 'EMERGENCY',
};

// Admin sharing is offered where the risk stage guide recommends it.
export function canShareWithAdmin(thread: BoardThread) {
  const level = getThreadRiskLevel(thread);
  return level === 'high' || level === 'emergency';
}

// Mock stand-in for the complaint record the server already holds.
export function createEscalationSnapshot(thread: BoardThread, teacherName: string): EscalationComplaintSnapshot {
  const deliveredMessage = thread.replies.find((reply) => reply.authorRole === 'parent')?.content ?? thread.latestMessage;

  return {
    bufferedSummary: getBufferedSummaryText(thread) ?? null,
    className: thread.className,
    maskedContent: maskContactInfo(deliveredMessage).text,
    originalContent: thread.originalMessage?.trim() || null,
    parentName: thread.parentName,
    riskFactors: getVisibleRiskFactors(thread).map((factor) => ({
      description: factor.description,
      evidenceSpan: factor.evidence || null,
      id: factor.id,
      name: factor.name,
      rationale: factor.rationale,
      status: factor.status === 'boundary' ? 'boundary' : 'detected',
    })),
    riskLevel: apiRiskLevel[getThreadRiskLevel(thread)],
    studentName: thread.studentName,
    teacherName,
    title: thread.title,
  };
}
