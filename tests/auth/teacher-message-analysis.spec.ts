import { expect, test, type Page } from '@playwright/test';
import { getRiskClassifications, riskCategories } from '../../src/features/risk-analysis';

async function openTeacherMessage(page: Page, id = 'thread-002') {
  await page.goto('/login?role=TEACHER');
  await page.locator('input[name="email"]').fill('teacher@example.com');
  await page.locator('input[name="password"]').fill('password123');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page).toHaveURL(/\/teacher(?:\/messages)?$/);
  await page.goto(`/teacher/messages/${id}`);
  await expect(page.locator('.board-detail')).toBeVisible();
}

async function changeAnalysis(page: Page, changes: Record<string, unknown>) {
  await page.evaluate(async (changes) => {
    const url = performance.getEntriesByType('resource').map((entry) => entry.name).find((path) => /\/mockThreads\.ts(?:\?|$)/.test(path));
    if (!url) throw new Error('메시지 예시 모듈을 찾지 못했습니다.');
    const { initialTeacherThreads } = await import(url);
    Object.assign(initialTeacherThreads.find((thread: { id: string }) => thread.id === 'thread-002').analysis, changes);
  }, changes);
}

async function openTab(page: Page, name: string) {
  await page.getByRole('navigation', { name: '메시지 상세 탭' }).getByRole('button', { name, exact: true }).click();
}

test('누락·중복 분류를 미탐지로 오인하지 않고 8개 분류를 반환한다', () => {
  const results = getRiskClassifications([
    { code: 'THREAT', status: 'PRESENT', evidenceSpan: '위협 표현' },
    { code: 'THREAT', status: 'ABSENT' },
    { code: 'REPETITION', status: 'ABSENT' },
  ]);
  expect(results).toHaveLength(8);
  expect(results.find((result) => result.code === 'THREAT')?.status).toBe('UNKNOWN');
  expect(results.find((result) => result.code === 'REPETITION')?.status).toBe('ABSENT');
  expect(results.filter((result) => result.status === 'UNKNOWN')).toHaveLength(7);
});

test('브라우저 제목과 8개 분류·근거를 표시하고 원문에서 근거를 선택한다', async ({ page }) => {
  await openTeacherMessage(page);
  await expect(page).toHaveTitle('TeacherHub');
  await openTab(page, '위험 요소');
  const classification = page.getByRole('region', { name: '8개 위험 요소 분류', exact: true });
  await expect(classification.locator('.ui-accordion-item')).toHaveCount(8);
  for (const category of riskCategories) await expect(classification.getByText(category.label, { exact: true })).toBeVisible();
  await classification.getByRole('button', { name: '감정적 표현 경계', exact: true }).click();
  await expect(classification.getByText('“아이가 계속 속상해합니다”', { exact: true })).toBeVisible();
  await classification.getByRole('button', { name: '원문에서 근거 확인', exact: true }).click();
  await page.getByRole('button', { name: '원문 확인', exact: true }).click();
  await expect(page.locator('.board-original-viewer-message .is-active')).toHaveText('아이가 계속 속상해합니다');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('분류 누락을 미확인으로 표시하고 원문 권한이 없으면 근거 구간을 노출하지 않는다', async ({ page }) => {
  await openTeacherMessage(page);
  await changeAnalysis(page, { canViewOriginal: false, riskClassifications: [
    { code: 'THREAT', status: 'PRESENT', evidenceSpan: '열람 권한이 필요한 근거', rationale: '위협 표현이 탐지되었습니다.' },
  ] });
  await openTab(page, '위험 요소');
  const classification = page.getByRole('region', { name: '8개 위험 요소 분류', exact: true });
  await expect(classification.getByText('미확인', { exact: true })).toHaveCount(7);
  await classification.getByRole('button', { name: '위협 탐지', exact: true }).click();
  await expect(classification).toContainText('원문 열람 권한이 없거나 원문이 제공되지 않아');
  await expect(page.getByText('열람 권한이 필요한 근거', { exact: false })).toHaveCount(0);
  await expect(classification.getByRole('button', { name: '원문에서 근거 확인', exact: true })).toHaveCount(0);
});

test('AI 최종 위험도는 교사 검토 위험도와 구분하고 목록 위험도가 달라도 완충 요약을 유지한다', async ({ page }) => {
  await openTeacherMessage(page);
  await changeAnalysis(page, { systemRiskLevel: 'high', teacherReviewedRiskLevel: 'medium' });
  await page.evaluate(async () => {
    const url = performance.getEntriesByType('resource').map((entry) => entry.name).find((path) => /\/mockThreads\.ts(?:\?|$)/.test(path))!;
    const { initialTeacherThreads } = await import(url);
    initialTeacherThreads.find((thread: { id: string }) => thread.id === 'thread-002').risk = 'normal';
  });
  await openTab(page, '위험 요소');
  await expect(page.locator('.board-card-meta').filter({ hasText: 'AI 최종 위험도' })).toContainText('위험');
  await expect(page.locator('.board-card-meta').filter({ hasText: '교사 검토 위험도' })).toContainText('주의');
  await openTab(page, '대화');
  await expect(page.locator('.board-moderation-card')).toContainText('친구와의 갈등 이후 학생 정서 확인과 후속 안내를 요청함.');
  await expect(page.locator('.board-reply-parent')).toHaveCount(0);
});

test('완충 요약 실패 시 이전 요약과 원문으로 자동 대체하지 않는다', async ({ page }) => {
  await openTeacherMessage(page);
  await changeAnalysis(page, { summary: { status: 'failed', text: '' } });
  await openTab(page, '위험 요소');
  await openTab(page, '대화');
  await expect(page.locator('.board-moderation-card')).toContainText('완충 요약을 확인할 수 없습니다');
  await expect(page.locator('.board-moderation-card')).not.toContainText('친구와의 갈등 이후 학생 정서');
  await expect(page.locator('.board-reply-parent')).toHaveCount(0);
  await page.getByRole('button', { name: /답변 (작성하러 가기|이어서 작성하기)/ }).click();
  await expect(page.locator('.board-reply-context-panel')).toContainText('완충 요약을 확인할 수 없습니다');
  await expect(page.locator('.board-reply-context-panel')).not.toContainText('어제 쉬는 시간에 있었던 일');
});

test('분석 실패·로딩·잘못된 응답을 구분하며 답변을 차단하고 정상 결과로 복구한다', async ({ page }) => {
  await openTeacherMessage(page);
  await changeAnalysis(page, { status: 'failed' });
  await openTab(page, '위험 요소');
  await expect(page.getByRole('alert')).toContainText('AI 분석 결과를 확인하지 못했습니다');
  await expect(page.locator('.board-risk-guide')).toHaveCount(0);
  await openTab(page, '대화');
  await expect(page.getByRole('button', { name: /답변 (작성하러 가기|이어서 작성하기)/ })).toHaveCount(0);
  await expect(page.locator('.board-reply-parent')).toHaveCount(0);

  await changeAnalysis(page, { status: 'loading' });
  await openTab(page, '위험 요소');
  await expect(page.getByRole('status')).toContainText('AI 메시지 분석 중입니다');
  await changeAnalysis(page, { status: 'ready', systemRiskLevel: 'INVALID' });
  await openTab(page, '대화');
  await openTab(page, '위험 요소');
  await expect(page.getByRole('alert')).toContainText('AI 분석 결과를 확인하지 못했습니다');
  await changeAnalysis(page, { systemRiskLevel: 'medium' });
  await openTab(page, '대화');
  await expect(page.getByRole('button', { name: /답변 (작성하러 가기|이어서 작성하기)/ })).toBeVisible();
});
