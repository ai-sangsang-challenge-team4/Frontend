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

async function expandEvidence(page: Page) {
  await page.getByRole('button', { name: '확인된 위험 요소와 판단 근거', exact: true }).click();
}

for (const back of ['page', 'browser'] as const) {
  test(`공식 절차를 보고 ${back === 'page' ? '가이드 뒤로가기' : '브라우저 뒤로가기'}로 같은 메시지의 위험 요소 탭에 돌아온다`, async ({ page }) => {
    await openTeacherMessage(page, 'thread-001');
    await openTab(page, '위험 요소');
    await page.getByRole('button', { name: '공식 절차 보기', exact: true }).click();
    await expect(page).toHaveURL(/\/teacher\/guide\?post=guide-emergency-official-procedure$/);
    if (back === 'page') await page.getByRole('button', { name: '이전 화면으로 돌아가기', exact: true }).click();
    else await page.goBack();
    await expect(page).toHaveURL(/\/teacher\/messages\/thread-001$/);
    await expect(page.getByRole('navigation', { name: '메시지 상세 탭' }).getByRole('button', { name: '위험 요소', exact: true })).toHaveClass(/is-active/);
    await expect(page.getByRole('button', { name: '공식 절차 보기', exact: true })).toBeVisible();
    if (back === 'browser') {
      await page.goForward();
      await expect(page).toHaveURL(/\/teacher\/guide\?post=guide-emergency-official-procedure$/);
      await page.getByRole('button', { name: '이전 화면으로 돌아가기', exact: true }).click();
      await expect(page.getByRole('navigation', { name: '메시지 상세 탭' }).getByRole('button', { name: '위험 요소', exact: true })).toHaveClass(/is-active/);
    }
  });
}

test('가이드에서 목록과 다른 글을 열고 새로고침해도 원래 메시지로 돌아간다', async ({ page }) => {
  await openTeacherMessage(page, 'thread-001');
  await openTab(page, '위험 요소');
  await page.getByRole('button', { name: '공식 절차 보기', exact: true }).click();
  await page.getByRole('navigation', { name: '현재 위치' }).getByRole('button', { name: '대응 가이드', exact: true }).click();
  await expect(page).toHaveURL(/\/teacher\/guide$/);
  await page.getByRole('region', { name: '대응 가이드 게시글 목록', exact: true }).getByRole('button').first().click();
  await expect(page).toHaveURL(/\/teacher\/guide\?post=/);
  await page.reload();
  await page.getByRole('button', { name: '이전 화면으로 돌아가기', exact: true }).click();
  await expect(page).toHaveURL(/\/teacher\/messages\/thread-001$/);
  await expect(page.getByRole('navigation', { name: '메시지 상세 탭' }).getByRole('button', { name: '위험 요소', exact: true })).toHaveClass(/is-active/);
});

test('추가 근거가 없으면 짧게 안내하고 미확인·미탐지 분류는 구분해 표시한다', async ({ page }, testInfo) => {
  await openTeacherMessage(page);
  await changeAnalysis(page, { riskFactors: [], riskClassifications: [] });
  await openTab(page, '위험 요소');
  await expandEvidence(page);
  const classifications = page.getByRole('region', { name: '8개 위험 요소 분류', exact: true });
  await expect(page.getByText('추가 판단 근거가 제공되지 않았어요.', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '추가로 표시할 판단 근거가 없습니다', exact: true })).toHaveCount(0);
  await expect(classifications.getByText('미확인', { exact: true })).toHaveCount(8);
  await changeAnalysis(page, { riskClassifications: riskCategories.map(({ code }) => ({ code, status: 'ABSENT' })) });
  await openTab(page, '대화');
  await openTab(page, '위험 요소');
  await expandEvidence(page);
  await expect(classifications.getByText('미탐지', { exact: true })).toHaveCount(8);
  await expect(classifications.getByText('미확인', { exact: true })).toHaveCount(0);
  await page.locator('.board-risk-evidence-panel').screenshot({ path: testInfo.outputPath('compact-evidence-note.png') });
});

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
  await expandEvidence(page);
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
  await expandEvidence(page);
  const classification = page.getByRole('region', { name: '8개 위험 요소 분류', exact: true });
  await expect(classification.getByText('미확인', { exact: true })).toHaveCount(7);
  await classification.getByRole('button', { name: '위협 탐지', exact: true }).click();
  await expect(classification).toContainText('원문 열람 권한이 없거나 원문이 제공되지 않아');
  await expect(page.getByText('열람 권한이 필요한 근거', { exact: false })).toHaveCount(0);
  await expect(classification.getByRole('button', { name: '원문에서 근거 확인', exact: true })).toHaveCount(0);
});

test('위험 근거는 기본 접힘이며 분류 요약·제목 툴팁·하단 행동을 별도로 제공한다', async ({ page }, testInfo) => {
  await openTeacherMessage(page);
  await changeAnalysis(page, { riskClassifications: [
    { code: 'THREAT', status: 'PRESENT', rationale: '위협 표현이 탐지되었습니다.' },
    { code: 'REPETITION', status: 'BOUNDARY', rationale: '반복 여부를 확인해 주세요.' },
    { code: 'EMOTIONAL_EXPRESSION', status: 'ABSENT' },
  ] });
  if (testInfo.project.name === 'mobile') await page.setViewportSize({ width: 320, height: 812 });
  await openTab(page, '위험 요소');
  const panel = page.locator('.board-risk-evidence-panel');
  const toggle = panel.getByRole('button', { name: '확인된 위험 요소와 판단 근거', exact: true });
  const summary = panel.getByRole('group', { name: '위험 요소 분류 요약', exact: true });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(panel.locator('.board-risk-evidence-content')).toBeHidden();
  await expect(panel.getByRole('button', { name: 'AI 판단이 틀렸어요', exact: true })).toHaveCount(0);
  for (const text of ['탐지 1개', '경계 1개', '미확인 5개', '미탐지 1개']) await expect(summary).toContainText(text);
  await expect(panel.getByRole('heading', { name: '8개 위험 요소 분류', exact: true })).toHaveCount(0);
  const help = panel.getByRole('button', { name: '위험 요소와 판단 근거 설명', exact: true });
  await help.focus();
  await expect(page.getByRole('tooltip')).toContainText('8개 위험 요소 분류');
  await expect(page.getByRole('tooltip')).toContainText('미확인은 분석 결과가 제공되지 않은 상태');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  const compactBox = (await panel.boundingBox())!;
  expect(compactBox.height).toBeLessThan(testInfo.project.name === 'mobile' ? 200 : 160);
  const helpBox = (await help.boundingBox())!;
  const indicatorBox = (await panel.locator('.board-risk-evidence-indicator').boundingBox())!;
  expect(indicatorBox.x).toBeGreaterThan(helpBox.x + helpBox.width);
  await panel.screenshot({ path: testInfo.outputPath('risk-evidence-collapsed.png') });
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(panel.getByRole('region', { name: '8개 위험 요소 분류', exact: true })).toBeVisible();
  const contentBox = (await panel.locator('.board-risk-evidence-content').boundingBox())!;
  const actionsBox = (await panel.locator('.board-risk-section-actions').boundingBox())!;
  const classificationBox = (await panel.locator('.board-risk-classifications').boundingBox())!;
  expect(actionsBox.y).toBeGreaterThanOrEqual(classificationBox.y + classificationBox.height - 1);
  expect(actionsBox.y + actionsBox.height).toBeLessThanOrEqual(contentBox.y + contentBox.height + 1);
  const panelBox = (await panel.boundingBox())!;
  const originalBox = (await panel.getByRole('button', { name: '원문 보기', exact: true }).boundingBox())!;
  expect(originalBox.x + originalBox.width).toBeLessThanOrEqual(panelBox.x + panelBox.width);
  expect(originalBox.x + originalBox.width).toBeGreaterThan(panelBox.x + panelBox.width / 2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await panel.screenshot({ path: testInfo.outputPath('risk-evidence-expanded.png') });
  await page.keyboard.press('Space');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(summary).toBeVisible();
  await expect(panel.getByRole('button', { name: 'AI 판단이 틀렸어요', exact: true })).toHaveCount(0);
});

test('AI 분석 위험도는 교사 검토 위험도와 구분하고 목록 위험도가 달라도 완충 요약을 유지한다', async ({ page }) => {
  await openTeacherMessage(page);
  await changeAnalysis(page, { systemRiskLevel: 'high', teacherReviewedRiskLevel: 'medium' });
  await page.evaluate(async () => {
    const url = performance.getEntriesByType('resource').map((entry) => entry.name).find((path) => /\/mockThreads\.ts(?:\?|$)/.test(path))!;
    const { initialTeacherThreads } = await import(url);
    initialTeacherThreads.find((thread: { id: string }) => thread.id === 'thread-002').risk = 'normal';
  });
  await openTab(page, '위험 요소');
  await expect(page.locator('.board-card-meta').filter({ hasText: 'AI 분석 위험도' })).toContainText('위험');
  await expect(page.locator('.board-card-meta').filter({ hasText: '교사 검토 위험도' })).toContainText('주의');
  await openTab(page, '대화');
  await expect(page.locator('.board-moderation-card')).toContainText('친구와의 갈등 이후 학생 정서 확인과 후속 안내를 요청함.');
  await expect(page.locator('.board-reply-parent')).toHaveCount(0);
});

test('AI 위험도 설명은 분석 후 제공하며 키보드·터치로 읽고 닫을 수 있다', async ({ page }, testInfo) => {
  await openTeacherMessage(page);
  await openTab(page, '위험 요소');
  const context = page.locator('.board-parent-card');
  await expect(page.locator('.board-risk-review-summary')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '최근 긴급 재검토 요청 상세', exact: true })).toHaveAttribute('aria-expanded', 'false');
  const trigger = context.getByRole('button', { name: 'AI 위험도 설명', exact: true });
  await trigger.focus();
  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toContainText('AI 시스템이 메시지의 위험 표현과 문맥을 분석');
  await expect(tooltip).toContainText('최종 대응은 담당자의 검토를 거쳐 결정됩니다.');
  await expect(trigger).toHaveAttribute('aria-describedby', await tooltip.getAttribute('id') ?? '');
  const box = (await tooltip.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  await page.keyboard.press('Escape');
  await expect(tooltip).toHaveCount(0);
  await expect(trigger).toBeFocused();
  if (testInfo.project.name === 'mobile') {
    await trigger.tap();
    await expect(tooltip).toBeVisible();
    await trigger.tap();
    await expect(tooltip).toHaveCount(0);
  } else {
    await trigger.hover();
    await expect(tooltip).toBeVisible();
    await tooltip.hover();
    await expect(tooltip).toBeVisible();
    await page.keyboard.press('Escape');
    await trigger.click();
    await expect(tooltip).toBeVisible();
  }
  await page.keyboard.press('Escape');
  await context.screenshot({ path: testInfo.outputPath('message-context-ai.png') });
});

for (const [systemRiskLevel, label] of [['low', '일반'], ['medium', '주의'], ['high', '위험'], ['emergency', '긴급']] as const) {
  test(`상단 카드에서 원래 AI 분석 ${systemRiskLevel} 표기를 유지한다`, async ({ page }) => {
    await openTeacherMessage(page);
    await changeAnalysis(page, { systemRiskLevel, currentRiskLevel: 'medium' });
    await openTab(page, '위험 요소');
    await expect(page.locator('.board-card-meta').filter({ hasText: 'AI 분석 위험도' })).toContainText(label);
  });
}

test('규칙 기반 잠정 결과를 AI 문맥 분석으로 표시하지 않는다', async ({ page }) => {
  await openTeacherMessage(page);
  await changeAnalysis(page, { aiAnalysisStatus: 'RULE_ONLY_INVALID_RESPONSE', systemRiskScore: 0 });
  await openTab(page, '위험 요소');
  const context = page.locator('.board-parent-card');
  await expect(context).toContainText('규칙 기반 잠정 위험도');
  await expect(context.getByText('AI 분석 위험도', { exact: true })).toHaveCount(0);
  await context.getByRole('button', { name: 'AI 위험도 설명', exact: true }).focus();
  await expect(page.getByRole('tooltip')).toContainText('AI 문맥 분석을 사용하지 못해 규칙만으로 산정한 잠정 위험도');
  await expect(page.getByRole('tooltip')).toContainText('시스템 위험 점수: 0/100');
});

test('완충 요약 실패 시 이전 요약과 원문으로 자동 대체하지 않는다', async ({ page }) => {
  await openTeacherMessage(page);
  await changeAnalysis(page, { summary: { status: 'failed', text: '' } });
  await openTab(page, '위험 요소');
  await openTab(page, '대화');
  await expect(page.locator('.board-moderation-card')).toContainText('완충 요약을 확인할 수 없습니다');
  await expect(page.locator('.board-moderation-card')).not.toContainText('친구와의 갈등 이후 학생 정서');
  await expect(page.locator('.board-reply-parent')).toHaveCount(0);
  await page.getByRole('button', { name: /^답변 (작성|이어서 작성하기)$/ }).click();
  await expect(page.locator('.board-inline-reply-composer .board-reply-compose-panel')).toBeVisible();
  await expect(page.locator('.board-moderation-card')).toContainText('완충 요약을 확인할 수 없습니다');
  await expect(page.locator('.board-reply-parent')).toHaveCount(0);
  await expect(page.locator('.board-conversation')).not.toContainText('어제 쉬는 시간에 있었던 일');
});

test('분석 실패·로딩·잘못된 응답을 구분하며 답변을 차단하고 정상 결과로 복구한다', async ({ page }) => {
  await openTeacherMessage(page);
  await changeAnalysis(page, { status: 'failed' });
  await openTab(page, '위험 요소');
  await expect(page.getByRole('alert')).toContainText('AI 분석 결과를 확인하지 못했습니다');
  await expect(page.getByRole('button', { name: 'AI 위험도 설명', exact: true })).toHaveCount(0);
  await expect(page.locator('.board-risk-guide')).toHaveCount(0);
  await openTab(page, '대화');
  await expect(page.getByRole('button', { name: 'AI 분석 근거', exact: true })).toBeDisabled();
  await expect(page.locator('.board-answer-box')).toContainText('AI 분석을 완료하지 못했습니다.');
  await expect(page.getByRole('button', { name: /^답변 (작성|이어서 작성하기)$/ })).toHaveCount(0);
  await expect(page.locator('.board-reply-parent')).toHaveCount(0);

  await changeAnalysis(page, { status: 'loading' });
  await openTab(page, '위험 요소');
  await expect(page.getByRole('status')).toContainText('AI 분석 결과를 불러오고 있어요');
  await expect(page.getByRole('button', { name: 'AI 위험도 설명', exact: true })).toHaveCount(0);
  await openTab(page, '대화');
  await expect(page.getByRole('button', { name: 'AI 분석 근거', exact: true })).toBeDisabled();
  await expect(page.locator('.board-answer-box')).not.toContainText('AI 분석이 아직 완료되지 않았습니다.');
  await expect(page.locator('.board-answer-box')).not.toContainText('AI 분석을 완료하지 못했습니다.');
  await expect(page.locator('.board-answer-box')).toContainText('답변 생성과 전송이 제한됩니다.');
  await changeAnalysis(page, { status: 'ready', systemRiskLevel: 'INVALID' });
  await openTab(page, '대화');
  await openTab(page, '위험 요소');
  await expect(page.getByRole('alert')).toContainText('AI 분석 결과를 확인하지 못했습니다');
  await changeAnalysis(page, { systemRiskLevel: 'medium' });
  await openTab(page, '대화');
  await expect(page.getByRole('button', { name: /^답변 (작성|이어서 작성하기)$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'AI 분석 근거', exact: true })).toBeEnabled();
});

test('Rule-only 잠정 배지와 검토 안내를 표시하고 100점과 교사 7단계를 구분한다', async ({ page }) => {
  await openTeacherMessage(page);
  await changeAnalysis(page, { systemRiskScore: 75, analysisMode: 'RULE_ONLY', manualReviewRequired: true });
  await openTab(page, '위험 요소');
  await expect(page.locator('.board-card-meta').filter({ hasText: '시스템 위험 점수' })).toHaveCount(0);
  await expect(page.locator('.board-risk-tab')).not.toContainText('시스템 위험 점수:');
  const scoreHelp = page.locator('.board-risk-review-copy').getByRole('button', { name: '위험도 점수 기준', exact: true });
  await scoreHelp.focus();
  await expect(page.getByRole('tooltip')).toContainText('시스템 위험 점수: 75/100');
  await expect(page.getByRole('tooltip')).toContainText('교사 검토는 별도의 1~7단계 척도');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await expect(scoreHelp).toBeFocused();
  await expect(page.locator('.board-risk-tab').getByText('잠정 분석', { exact: true })).toBeVisible();
  await expect(page.locator('.board-risk-tab')).toContainText('교사의 직접 검토가 필요합니다.');
  await expect(page.getByRole('button', { name: '7점 매우 위험', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '8점', exact: false })).toHaveCount(0);
});

test('결과 로딩 중에는 미확인 원문 권한을 제한으로 단정하지 않고 답변 잠금을 유지한다', async ({ page }) => {
  await openTeacherMessage(page);
  await changeAnalysis(page, { status: 'loading', canViewOriginal: false, originalMessageAvailable: false });
  await openTab(page, '위험 요소');
  const notice = page.getByRole('status');
  await expect(notice).not.toContainText('원문 열람 권한이 없거나');
  await expect(notice).toContainText('AI 분석 결과를 불러오고 있어요');
  await expect(notice).toHaveAttribute('aria-busy', 'true');
  await expect(notice.getByRole('button', { name: '원문 보기', exact: true })).toHaveCount(0);
  await openTab(page, '대화');
  await expect(page.locator('.board-answer-box')).toHaveClass(/is-locked/);
  await expect(page.getByRole('button', { name: /^답변 (작성|이어서 작성하기)$/ })).toHaveCount(0);
});

for (const score of [0, undefined]) {
  test(`점수 도움말에서 ${score === 0 ? '실제 0점' : '미제공 점수'} 구분과 터치·키보드 닫힘을 확인한다`, async ({ page }, testInfo) => {
    await openTeacherMessage(page);
    await changeAnalysis(page, { systemRiskScore: score });
    await openTab(page, '위험 요소');
    const trigger = page.getByRole('button', { name: '위험도 점수 기준', exact: true });
    await trigger.focus();
    const tooltip = page.getByRole('tooltip');
    if (score === 0) await expect(tooltip).toContainText('시스템 위험 점수: 0/100');
    else await expect(tooltip).not.toContainText('0/100');
    await expect(tooltip).toContainText('교사 검토는 별도의 1~7단계 척도');
    const box = (await tooltip.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    await page.keyboard.press('Escape');
    await expect(tooltip).toHaveCount(0);
    if (testInfo.project.name === 'mobile') {
      await trigger.tap();
      await expect(tooltip).toBeVisible();
      await trigger.tap();
      await expect(tooltip).toHaveCount(0);
    }
  });
}

test('검토 권한이 없는 화면에서도 시스템 점수는 위험도 설명에서 확인한다', async ({ page }) => {
  await openTeacherMessage(page);
  await changeAnalysis(page, { canReviewRisk: false, systemRiskScore: 75 });
  await openTab(page, '위험 요소');
  await expect(page.locator('.board-risk-review-panel')).toHaveCount(0);
  await page.locator('.board-parent-card').getByRole('button', { name: 'AI 위험도 설명', exact: true }).focus();
  await expect(page.getByRole('tooltip')).toContainText('시스템 위험 점수: 75/100');
});
