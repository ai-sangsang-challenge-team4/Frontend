import { expect, test } from '@playwright/test';
import { validateFinalMessage } from '../../src/features/parent-message/parentMessageTypes';
import { toServerAnalysis } from '../../src/features/parent-message/serverComplaint';
import { toActivityLogs } from '../../src/features/message/serverThreads';
import { validateChildSignupInfo } from '../../src/features/auth/childSignup';
import { validateTeacherSignupInfo } from '../../src/features/auth/teacherSignup';

// Independent contract boundaries from https://teacherhub.duckdns.org/v3/api-docs (2026-11-17).
test('Swagger의 학부모 문의 5000자 경계를 적용한다', () => {
  expect(validateFinalMessage('가'.repeat(5000))).toBeNull();
  expect(validateFinalMessage('가'.repeat(5001))).toBe('문의 내용은 5000자 이내로 작성해 주세요.');
});

for (const revisionStatus of ['PENDING', 'UNAVAILABLE', 'NOT_REQUESTED'] as const) {
  test(`${revisionStatus} 수정안은 이전 수정문을 표시하지 않고 위험 근거를 유지한다`, () => {
    const result = toServerAnalysis({
      revisionStatus,
      findings: [{ code: 'THREAT', evidences: ['확인이 필요합니다.'], revisionSuggestions: [
        { originalExpression: '확인이 필요합니다.', suggestedExpression: '이전 수정 문장', reason: '이전 수정 이유' },
      ] }],
      finalRevision: { content: '이전 전체 수정안', reason: '이전 이유' },
    }, '확인이 필요합니다.');
    expect(result.revisionStatus).toBe(revisionStatus);
    expect(result.revisedText).toBeNull();
    expect(result.risks[0].excerpt).toBe('확인이 필요합니다.');
    expect(result.risks[0].suggestion).toBeUndefined();
  });
}

test('AI 폴백·정책 차단 이벤트를 처리 기록의 한국어 작업명으로 표시한다', () => {
  const types = ['AI_ANALYSIS_SKIPPED', 'AI_ANALYSIS_RULE_FALLBACK', 'AI_DRAFT_BLOCKED_BY_RISK_POLICY', 'RESPONSE_BLOCKED_BY_RISK_POLICY'] as const;
  const logs = toActivityLogs(types.map((type, index) => ({
    eventId: String(index), type, occurredAt: '2026-11-17T10:00:00',
  })));
  for (const log of logs) expect(log.action).not.toMatch(/^[A-Z_]+$/);
});

test('회원가입의 자녀 이름과 교번은 서버 길이 제한을 넘기지 않는다', () => {
  const child = { schoolId: 1, schoolName: '학교', grade: 1, schoolClassId: 2, studentId: 3, name: '가'.repeat(50) };
  expect(validateChildSignupInfo(child)).toEqual({});
  expect(validateChildSignupInfo({ ...child, name: '가'.repeat(51) }).name).toBeTruthy();
  expect(validateTeacherSignupInfo({ schoolId: 1, employeeNo: 'a'.repeat(100) })).toEqual({});
  expect(validateTeacherSignupInfo({ schoolId: 1, employeeNo: 'a'.repeat(101) }).employeeNo).toBeTruthy();
});
