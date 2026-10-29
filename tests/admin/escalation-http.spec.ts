import { expect, test, type Page } from '@playwright/test';

// Uses the real HTTP adapter and the supplied Admin Escalation response shapes.
// The server responses are fixtures; this suite never changes live backend data.
const summary = {
  escalationId: 3, emergencyReviewRequestId: null, complaintId: 12,
  sharedBy: '공유 교사', reason: '학교 공동 대응이 필요합니다.',
  currentRiskLevel: 'EMERGENCY', escalationStatus: 'SHARED',
  riskReviewStatus: null, safetyLock: true, sharedAt: '2026-10-29T10:00:00',
};
const risk = {
  complaintId: 12, riskAnalysisId: 4, riskScore: 30, riskLevel: 'EMERGENCY',
  reviewScore: 7, reviewLevel: 'EMERGENCY', safetyLock: true,
  analyzedAt: '2026-10-29T09:59:00', latestReview: null,
  detectedFactors: [
    {
      code: 'THREAT', name: '위협', state: 'PRESENT', reason: '직접적인 위해 표현입니다.',
      evidenceSpans: [{ text: '가만두지 않겠습니다', start: 0, end: 10 }, { text: '찾아가겠습니다', start: 11, end: 19 }],
    },
    { code: 'INSULT', name: '인신공격', state: 'BOUNDARY', reason: '맥락 확인이 필요합니다.', evidenceSpans: [] },
    { code: 'PROFANITY', name: '욕설', state: 'ABSENT', reason: '욕설은 없습니다.', evidenceSpans: [] },
    { code: 'PRIVACY', name: '개인정보', state: 'UNKNOWN', reason: '', evidenceSpans: [] },
  ],
};
const history = {
  complaintId: 12, logComplete: false,
  missingLogs: [{ expectedType: 'MESSAGE_SENT', referenceType: 'MESSAGE', referenceId: 8, description: '메시지 전송 기록이 누락되었습니다.' }],
  events: [{
    eventId: 'event:1', type: 'STATUS_CHANGED', occurredAt: '2026-10-29T10:01:00',
    actorName: '공유 교사', previousStatus: 'DRAFT', newStatus: 'OPEN',
    referenceType: 'COMPLAINT', referenceId: 12,
  }],
};

async function setup(page: Page, overrides: { risk?: unknown; history?: unknown; messages?: unknown } = {}) {
  let status = 'SHARED';
  const calls: string[] = [];
  await page.route('**/api/admin/escalations**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api', '');
    calls.push(`${request.method()} ${path}`);
    const current = { ...summary, escalationStatus: status };
    let response: unknown;
    switch (path) {
      case '/admin/escalations': response = [current]; break;
      case '/admin/escalations/3': response = current; break;
      case '/admin/escalations/3/risk': response = overrides.risk ?? risk; break;
      case '/admin/escalations/3/history': response = overrides.history ?? history; break;
      case '/admin/escalations/3/messages': response = overrides.messages ?? {
        reason: summary.reason, mediationPackageIncluded: true,
        maskedMessages: [{ messageId: 'message:8', senderRole: 'PARENT', senderName: '학부모', content: '공유된 메시지', status: 'READ', sentAt: '2026-10-29T09:58:00', readAt: '2026-10-29T10:02:00', summarized: true }],
        originalMessages: [],
      }; break;
      case '/admin/escalations/3/review':
      case '/admin/escalations/3/complete':
        expect(request.method()).toBe('POST');
        expect(request.postDataJSON()).toEqual({ message: path.endsWith('/review') ? '검토 메모' : '완료 메모' });
        status = path.endsWith('/review') ? 'UNDER_REVIEW' : 'COMPLETED';
        response = { ...current, escalationStatus: status, currentRiskScore: 7 };
        break;
      default: throw new Error(`Unexpected escalation request: ${request.method()} ${path}`);
    }
    await route.fulfill({ json: response });
  });
  await page.goto('/login?role=ADMIN');
  await page.locator('input[name="email"]').fill('admin@teacherhub.local');
  await page.locator('input[name="password"]').fill('admin1234');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await page.getByRole('link', { name: '민원 #12 공유 메시지 상세 보기' }).click();
  return calls;
}

const openTab = (page: Page, name: string) => page.getByRole('navigation', { name: '공유 메시지 상세 탭' }).getByRole('button', { name, exact: true }).click();

test('명세의 메시지·위험 요소·누락 이력을 표시하고 검토 시작부터 완료까지 HTTP로 처리한다', async ({ page }) => {
  const calls = await setup(page);
  const shared = page.getByRole('region', { name: '개인정보가 가려진 메시지', exact: true });
  await expect(shared.getByText('읽음', { exact: true })).toBeVisible();
  await expect(shared.getByText(/읽은 시각/)).toContainText('10:02');

  await openTab(page, '위험 분석');
  await expect(page.getByRole('button', { name: '위협 탐지', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '인신공격 경계', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '욕설 미탐지', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '개인정보 미확인', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '위협 탐지', exact: true }).click();
  await expect(page.getByText('가만두지 않겠습니다', { exact: true })).toBeVisible();
  await expect(page.getByText('찾아가겠습니다', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '인신공격 경계', exact: true }).click();
  await expect(page.getByText('제공된 근거 구간이 없습니다.', { exact: true })).toBeVisible();

  await openTab(page, '처리 기록');
  const historyPanel = page.getByRole('region', { name: '처리 기록', exact: true });
  await expect(historyPanel.getByRole('alert')).toContainText('일부 처리 기록이 누락되었습니다.');
  await expect(historyPanel.getByText('메시지 전송 기록이 누락되었습니다.')).toBeVisible();
  await expect(historyPanel.getByText('메시지 #8', { exact: true })).toBeVisible();
  await expect(historyPanel.getByText('작성 중 → 진행 중', { exact: true })).toBeVisible();
  await expect(historyPanel.getByText('민원 #12', { exact: true })).toBeVisible();

  const process = page.getByRole('region', { name: '처리 상태', exact: true });
  await process.getByLabel('처리 메모').fill('  검토 메모  ');
  await process.getByRole('button', { name: '검토 시작', exact: true }).click();
  await expect(process.locator('[aria-current="step"]')).toHaveText(/검토 중/);
  await process.getByLabel('처리 메모').fill('완료 메모');
  await process.getByRole('button', { name: '처리 완료', exact: true }).click();
  await page.getByRole('dialog', { name: '처리 완료로 변경할까요?' }).getByRole('button', { name: '처리 완료', exact: true }).click();
  await expect(process.locator('[aria-current="step"]')).toHaveText(/처리 완료/);
  expect(calls).toEqual(expect.arrayContaining([
    'GET /admin/escalations', 'GET /admin/escalations/3', 'GET /admin/escalations/3/messages',
    'GET /admin/escalations/3/risk', 'GET /admin/escalations/3/history',
    'POST /admin/escalations/3/review', 'POST /admin/escalations/3/complete',
  ]));
});

test('이벤트가 없어도 로그 누락을 알리고, 불완전 응답은 기록 없음으로 단정하지 않는다', async ({ page }) => {
  await setup(page, { history: { complaintId: 12, logComplete: false, missingLogs: [], events: [] } });
  await openTab(page, '처리 기록');
  const panel = page.getByRole('region', { name: '처리 기록', exact: true });
  await expect(panel.getByRole('alert')).toContainText('일부 처리 기록이 누락되었습니다.');
  await expect(panel.getByText('조회된 처리 기록이 없습니다.', { exact: true })).toBeVisible();
});

test('이전 응답 형식도 표시하며 누락 목록이 있으면 logComplete 값과 관계없이 알린다', async ({ page }) => {
  await setup(page, {
    risk: { ...risk, detectedFactors: [{ code: 'THREAT', name: '위협', evidence: '이전 형식의 근거', reason: '위협 표현' }] },
    messages: { reason: summary.reason, maskedMessages: [], mediationPackageIncluded: false, originalMessages: [{ messageId: 'legacy:1', senderRole: 'PARENT', senderName: '학부모', content: '이전 메시지', sentAt: '2026-10-29T09:58:00', summarized: false }] },
    history: { ...history, logComplete: true, events: [] },
  });
  await expect(page.getByText('이전 메시지', { exact: true })).toBeVisible();
  await expect(page.getByText(/읽은 시각/)).toHaveCount(0);
  await openTab(page, '위험 분석');
  await page.getByRole('button', { name: '위협 탐지', exact: true }).click();
  await expect(page.getByText('이전 형식의 근거', { exact: true })).toBeVisible();
  await openTab(page, '처리 기록');
  await expect(page.getByRole('alert')).toContainText('메시지 전송 기록이 누락되었습니다.');
});

test('알 수 없는 상태값은 원래 값으로 표시하고, 같은 종류의 누락 항목도 모두 표시한다', async ({ page }) => {
  await setup(page, {
    messages: { reason: summary.reason, mediationPackageIncluded: false, originalMessages: [], maskedMessages: [{ messageId: 'message:9', senderRole: 'PARENT', senderName: '학부모', content: '새 상태 메시지', status: 'ARCHIVED', sentAt: '2026-10-29T09:58:00', readAt: null, summarized: false }] },
    history: {
      complaintId: 12, logComplete: false,
      missingLogs: [
        { expectedType: 'MESSAGE_SENT', referenceType: 'MESSAGE', referenceId: 8, description: '메시지 기록 누락' },
        { expectedType: 'MESSAGE_SENT', referenceType: 'COMPLAINT', referenceId: 8, description: '민원 기록 누락' },
      ],
      events: [{ eventId: 'event:2', type: 'STATUS_CHANGED', occurredAt: '2026-10-29T10:01:00', actorName: '공유 교사', previousStatus: 'OPEN', newStatus: 'ARCHIVED' }],
    },
  });
  await expect(page.getByText('ARCHIVED', { exact: true })).toBeVisible();
  await openTab(page, '처리 기록');
  const panel = page.getByRole('region', { name: '처리 기록', exact: true });
  await expect(panel.getByText('진행 중 → ARCHIVED', { exact: true })).toBeVisible();
  await expect(panel.getByText(/undefined/)).toHaveCount(0);
  await expect(panel.getByText('메시지 기록 누락', { exact: true })).toBeVisible();
  await expect(panel.getByText('민원 기록 누락', { exact: true })).toBeVisible();
});
