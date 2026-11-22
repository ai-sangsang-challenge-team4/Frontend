import { expect, test, type Page } from '@playwright/test';

const body = '지난주에도 상담 요청드렸는데 연락이 없으셔서 문의드립니다. 연락처는 010-1234-5678, 이메일은 parent@test.com입니다.';
const sentKey = 'teacher-hub.parent-sent-messages.101';

async function login(page: Page, role: 'PARENT' | 'TEACHER') {
  await page.goto(`/login?role=${role}`);
  await page.locator('input[name="email"]').fill(role === 'PARENT' ? 'parent@example.com' : 'teacher@example.com');
  await page.locator('input[name="password"]').fill('password123');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page).toHaveURL(role === 'PARENT' ? /\/parent\/messages\/new$/ : /\/teacher(?:\/messages)?$/);
}

async function writeMessage(page: Page) {
  await login(page, 'PARENT');
  await page.evaluate(() => localStorage.setItem('teacher-hub.parent-message-mock-settings', JSON.stringify({ analysisDelayMs: 50, sendDelayMs: 50 })));
  await page.getByLabel('문의 제목', { exact: true }).fill('상담 요청 010-9876-5432');
  await page.getByLabel('문의 내용', { exact: true }).fill(body);
}

async function setMaskingFailure(page: Page, failMasking: boolean) {
  await page.evaluate((value) => localStorage.setItem('teacher-hub.pii-mock-settings', JSON.stringify({ failMasking: value })), failMasking);
}

const riskTab = (page: Page) => page.getByRole('navigation', { name: '메시지 상세 탭' }).getByRole('button', { name: '위험 요소', exact: true });
const conversationTab = (page: Page) => page.getByRole('navigation', { name: '메시지 상세 탭' }).getByRole('button', { name: '대화', exact: true });

test('제목·본문 마스킹 결과를 표시하고 가린 문장으로 분석·전송한다', async ({ page }, testInfo) => {
  await writeMessage(page);
  const privacy = page.getByRole('region', { name: '개인정보 마스킹 상태', exact: true });
  await expect(privacy).toContainText('3건 마스킹');
  await privacy.getByText('마스킹 결과 보기', { exact: true }).click();
  await expect(privacy).toContainText('제목: 상담 요청 [전화번호]');
  await expect(privacy).toContainText('[이메일]');
  await expect(privacy).not.toContainText('010-1234-5678');
  await expect(privacy).not.toContainText('parent@test.com');
  await privacy.screenshot({ path: testInfo.outputPath('privacy-masking.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.getByRole('button', { name: 'AI 분석 시작', exact: true }).click();
  await expect(page).toHaveURL(/\/review$/);
  const aiDraft = page.getByLabel('AI 초안 내용', { exact: true });
  await expect(aiDraft).toHaveValue(/\[전화번호\]/);
  await expect(aiDraft).not.toHaveValue(/010-1234-5678|parent@test.com/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('teacher-hub.parent-message-draft.101')!).body)).toBe(body);
  await expect(page.locator('.ai-judgment-notice')).toContainText('AI 판단은 참고 정보');
  await page.getByRole('button', { name: '전송하기', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '문의를 전송할까요?', exact: true });
  await expect(dialog).not.toContainText('010-9876-5432');
  await dialog.getByRole('button', { name: '확인 후 전송', exact: true }).click();
  await expect(page.getByRole('heading', { name: '전송 완료', exact: true })).toBeVisible();
  const messages = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), sentKey);
  expect(messages[0].title).toBe('상담 요청 [전화번호]');
  expect(messages[0].originalBody).toBe('지난주에도 상담 요청드렸는데 연락이 없으셔서 문의드립니다. 연락처는 [전화번호], 이메일은 [이메일]입니다.');
  expect(messages[0].finalBody).not.toMatch(/010-1234-5678|parent@test.com/);
  expect(JSON.stringify(messages)).not.toMatch(/010-9876-5432|010-1234-5678|parent@test.com/);
  expect(await page.evaluate(() => localStorage.getItem('teacher-hub.parent-message-draft.101'))).toBeNull();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('teacher-hub.parent-message-draft.101.all')!))).toEqual([]);
});

test('마스킹 실패 시 분석을 시작하지 않고 입력을 유지하며 재시도를 제공한다', async ({ page }, testInfo) => {
  await writeMessage(page);
  await setMaskingFailure(page, true);
  await page.getByRole('button', { name: 'AI 분석 시작', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('개인정보 마스킹에 실패했습니다.');
  await expect(page.getByRole('button', { name: 'AI 분석 시작', exact: true })).toBeDisabled();
  await expect(page.getByRole('region', { name: '메시지 분석 중' })).toHaveCount(0);
  await expect(page.getByLabel('문의 내용', { exact: true })).toHaveValue(body);
  await expect(page).toHaveURL(/\/new$/);
  expect(await page.evaluate((key) => localStorage.getItem(key), sentKey)).toBeNull();
  await page.getByRole('region', { name: '개인정보 마스킹 상태' }).screenshot({ path: testInfo.outputPath('privacy-failed.png') });
  await page.getByRole('button', { name: '마스킹 다시 시도', exact: true }).click();
  await expect(page).toHaveURL(/\/new$/);
  await setMaskingFailure(page, false);
  await page.getByRole('button', { name: '마스킹 다시 시도', exact: true }).click();
  await expect(page).toHaveURL(/\/review$/);
});

test('분석 후 수정한 개인정보를 다시 검사하고 확인창 이후 실패도 전송을 차단한다', async ({ page }) => {
  await writeMessage(page);
  await page.getByRole('button', { name: 'AI 분석 시작', exact: true }).click();
  await expect(page).toHaveURL(/\/review$/);
  await page.getByLabel('AI 초안 내용', { exact: true }).fill('새 연락처 010-2222-3333으로 연락 부탁드립니다.');
  await expect(page.getByRole('region', { name: '개인정보 마스킹 상태' })).toContainText('2건 마스킹');
  await setMaskingFailure(page, true);
  await page.getByRole('button', { name: '전송하기', exact: true }).click();
  await expect(page.getByRole('button', { name: '전송하기', exact: true })).toBeDisabled();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await setMaskingFailure(page, false);
  await page.getByRole('button', { name: '마스킹 다시 시도', exact: true }).click();
  await page.getByRole('button', { name: '전송하기', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '문의를 전송할까요?', exact: true });
  await expect(dialog).not.toContainText('010-2222-3333');
  await setMaskingFailure(page, true);
  await dialog.getByRole('button', { name: '확인 후 전송', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('alert')).toContainText('개인정보 마스킹에 실패했습니다.');
  expect(await page.evaluate((key) => localStorage.getItem(key), sentKey)).toBeNull();
});

test('실제 재검토 요청 하나와 대기 상태를 표시하고 중복 요청 및 답변 작성을 차단한다', async ({ page }, testInfo) => {
  await login(page, 'TEACHER');
  await page.goto('/teacher/messages/thread-001');
  await riskTab(page).click();
  await expect(page.locator('.board-risk-guide')).toContainText('‘긴급’ 단계에서는 답변 작성이 제한됩니다.');
  await expect(page.locator('.board-risk-recheck-button')).toHaveCount(0);
  await page.getByRole('button', { name: '5점 위험', exact: true }).click();
  const request = page.getByRole('button', { name: '재검토 요청', exact: true });
  await expect(request).toHaveCount(1);
  await expect(request).toBeDisabled();
  await expect(request).toHaveAccessibleDescription(/검토 사유를 입력/);
  await page.getByPlaceholder('하향 수정 사유를 입력해주세요.').fill('문의 내용과 근거를 다시 확인했습니다.');
  const help = page.getByRole('button', { name: '재검토 요청 안내', exact: true });
  await help.click();
  await expect(page.getByRole('tooltip')).toContainText('승인되면 위험도 하향과 안전 잠금 해제가 함께 반영');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await expect(page.locator('.board-risk-lock-review')).toHaveCount(0);
  await expect(request).toBeEnabled();
  await request.evaluate((button) => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
  await expect(page.getByRole('button', { name: '검토자 확인 대기', exact: true })).toBeDisabled();
  await expect(page.locator('.board-risk-lock-review')).toHaveCount(0);
  await expect(page.locator('.board-risk-review-info')).toContainText('검토자가 확인하고 있어요.');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('teacher-hub.emergency-reviews.v2') ?? '[]').length)).toBe(1);
  if (testInfo.project.name === 'mobile') await page.setViewportSize({ width: 320, height: 812 });
  const panelBox = await page.locator('.board-risk-review-panel').boundingBox();
  const helpBox = await help.boundingBox();
  expect(helpBox!.x + helpBox!.width).toBeLessThanOrEqual(panelBox!.x + panelBox!.width);
  await page.locator('.board-risk-review-footer').screenshot({ path: testInfo.outputPath('review-pending.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('navigation', { name: '메시지 상세 탭' }).getByRole('button', { name: '처리 기록', exact: true }).click();
  await expect(page.getByText('긴급 위험도 하향 승인 요청', { exact: true })).toHaveCount(1);
  await expect(page.getByText('위험도 재검토 요청', { exact: true })).toHaveCount(0);
  await conversationTab(page).click();
  await expect(page.getByText('긴급 단계에서는 답변 생성과 전송이 제한돼요.', { exact: true })).toBeVisible();
  await expect(page.locator('.board-answer-box')).toHaveClass(/is-locked/);
  await page.locator('.board-answer-box').screenshot({ path: testInfo.outputPath('safety-lock.png') });
  await expect(page.getByRole('button', { name: /^답변 (작성|이어서 작성하기)$/ })).toHaveCount(0);
});

test('잠금이 없으면 위험도 검토만 저장하고 가짜 재검토 접수는 표시하지 않는다', async ({ page }) => {
  await login(page, 'TEACHER');
  await page.goto('/teacher/messages/thread-002');
  await page.evaluate(async () => {
    const url = performance.getEntriesByType('resource').map((entry) => entry.name).find((path) => /\/mockThreads\.ts(?:\?|$)/.test(path));
    if (!url) throw new Error('메시지 예시 모듈을 찾지 못했습니다.');
    const { initialTeacherThreads } = await import(url);
    initialTeacherThreads.find((thread: { id: string }) => thread.id === 'thread-002').riskReviewRequired = true;
  });
  await riskTab(page).click();
  await expect(page.locator('.board-risk-lock-review')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '재검토 요청', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '검토 완료', exact: true }).click();
  await expect(page.locator('.board-risk-lock-review')).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('teacher-hub.emergency-reviews.v2') ?? '[]').length)).toBe(0);
  await conversationTab(page).click();
  await expect(page.getByRole('button', { name: /^답변 (작성|이어서 작성하기)$/ })).toBeVisible();
});

test('학생 안전 신호의 없음·추가 확인·긴급 확인을 구분한다', async ({ page }, testInfo) => {
  await login(page, 'TEACHER');
  await page.goto('/teacher/messages/thread-002');
  await riskTab(page).click();
  await expect(page.locator('.board-student-safety-card')).toHaveCount(0);
  await page.goto('/teacher/messages/thread-004');
  await riskTab(page).click();
  await expect(page.locator('.board-student-safety-card')).toContainText('추가 확인 필요');
  await conversationTab(page).click();
  await page.evaluate(async () => {
    const url = performance.getEntriesByType('resource').map((entry) => entry.name).find((path) => /\/mockThreads\.ts(?:\?|$)/.test(path));
    if (!url) throw new Error('메시지 예시 모듈을 찾지 못했습니다.');
    const { initialTeacherThreads } = await import(url);
    initialTeacherThreads.find((thread: { id: string }) => thread.id === 'thread-004').analysis.studentSafetySignal = 'URGENT_REVIEW';
  });
  await riskTab(page).click();
  await expect(page.locator('.board-student-safety-card')).toContainText('긴급 확인 필요');
  await expect(page.locator('.board-student-safety-card')).toContainText('학생의 현재 안전을 우선 확인');
  await page.locator('.board-student-safety-card').screenshot({ path: testInfo.outputPath('student-safety-urgent.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('긴급 이하의 safetyLock과 권한 제한을 안내하고 가짜 재검토 접수를 만들지 않는다', async ({ page }) => {
  await login(page, 'TEACHER');
  await page.goto('/teacher/messages/thread-002');
  await page.evaluate(async () => {
    const url = performance.getEntriesByType('resource').map((entry) => entry.name).find((path) => /\/mockThreads\.ts(?:\?|$)/.test(path));
    if (!url) throw new Error('메시지 예시 모듈을 찾지 못했습니다.');
    const { initialTeacherThreads } = await import(url);
    const analysis = initialTeacherThreads.find((thread: { id: string }) => thread.id === 'thread-002').analysis;
    analysis.safetyLock = true;
    analysis.canReviewRisk = false;
  });
  await riskTab(page).click();
  await expect(page.locator('.board-risk-lock-review')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '검토 완료', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '재검토 요청', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('teacher-hub.emergency-reviews.v2') ?? '[]').length)).toBe(0);
  await conversationTab(page).click();
  await expect(page.getByText('안전 확인을 위해 답변 작성이 제한됩니다.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^답변 (작성|이어서 작성하기)$/ })).toHaveCount(0);
});
