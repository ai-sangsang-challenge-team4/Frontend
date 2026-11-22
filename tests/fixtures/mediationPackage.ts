import type { MediationPackageResponse } from '../../src/features/message/api/teacherInboxTypes';

export function mediationPackage(includeOriginalMessages = false): MediationPackageResponse {
  return {
    packageId: includeOriginalMessages ? 'package-original' : 'package-masked', complaintId: 12,
    schemaVersion: 1, originalMessagesIncluded: includeOriginalMessages, checksumSha256: 'test-checksum', createdAt: '2026-11-22T10:00:00',
    content: {
      schemaVersion: 1, packageId: includeOriginalMessages ? 'package-original' : 'package-masked', generatedAt: '2026-11-22T10:00:00',
      complaint: { complaintId: 12, status: 'OPEN' }, originalMessagesIncluded: includeOriginalMessages,
      messages: [{ messageId: 1, senderRole: 'PARENT', sentAt: '2026-11-22T09:00:00', maskedContent: '[이름] 학생의 상담 기록입니다.', originalContent: includeOriginalMessages ? '테스트 학생 원문입니다.' : null }],
      analyses: [{ analysisId: 4, riskLevel: 'HIGH', riskScore: 50, analyzedAt: '2026-11-22T09:00:00', riskTags: [{ code: 'REPEAT', name: '반복 문의', state: 'DETECTED', evidence: '확인 요청', reason: '같은 문의가 반복되었습니다.' }] }],
      responseHistory: { logComplete: true, missingLogs: [], events: [{ eventId: 'event:1', type: 'RISK_ANALYZED', occurredAt: '2026-11-22T09:00:00', reason: '분석 완료' }] },
    },
  };
}
