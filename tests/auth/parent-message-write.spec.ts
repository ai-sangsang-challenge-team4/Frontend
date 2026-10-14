import { expect, test, type Page } from '@playwright/test';

const draftKey = 'teacher-hub.parent-message-draft.101';

async function openComposer(page: Page) {
  await page.goto('/login?role=PARENT');
  await page.locator('input[name="email"]').fill('parent@example.com');
  await page.locator('input[name="password"]').fill('password123');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page).toHaveURL(/\/parent$/);
  await page.goto('/parent/messages/new');
  await expect(page.getByRole('heading', { name: '새 문의 작성', exact: true })).toBeVisible();
}

async function fillMessage(page: Page) {
  await page.getByLabel('문의 제목', { exact: true }).fill('상담 일정을 문의드립니다.');
  await page.getByLabel('문의 내용', { exact: true }).fill('선생님 안녕하세요. 다음 주 상담 가능한 시간을 알려 주실 수 있을까요?');
}

test('빈 입력과 공백 입력을 차단하고 임시저장한 메시지를 새로고침 후 복원한다', async ({ page }) => {
  await openComposer(page);
  const title = page.getByLabel('문의 제목', { exact: true });
  const body = page.getByLabel('문의 내용', { exact: true });

  await page.getByRole('button', { name: 'AI 분석 시작', exact: true }).click();
  await expect(title).toHaveAttribute('aria-invalid', 'true');
  await expect(body).toHaveAttribute('aria-invalid', 'true');
  await expect(title).toBeFocused();
  await expect(page.getByRole('region', { name: '메시지 분석 중' })).toHaveCount(0);

  await title.fill('   ');
  await body.fill(' \n ');
  await page.getByRole('button', { name: 'AI 분석 시작', exact: true }).click();
  await expect(title).toHaveAttribute('aria-invalid', 'true');
  await expect(body).toHaveAttribute('aria-invalid', 'true');

  await fillMessage(page);
  await page.getByRole('button', { name: '임시저장', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('문의가 임시저장되었습니다.');
  await page.reload();
  await expect(title).toHaveValue('상담 일정을 문의드립니다.');
  await expect(body).toHaveValue('선생님 안녕하세요. 다음 주 상담 가능한 시간을 알려 주실 수 있을까요?');

  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), draftKey);
  expect(saved.status).toBe('DRAFT');
  expect(saved.teacherId).toBe('teacher-102');
});

test('분석 중 화면을 표시하고 뒤로가기 시 입력을 유지하며 검토 경로로 연결한다', async ({ page }, testInfo) => {
  await openComposer(page);
  await fillMessage(page);
  await page.getByRole('button', { name: 'AI 분석 시작', exact: true }).click();
  const loading = page.getByRole('region', { name: '메시지 분석 중' });
  await expect(loading).toBeVisible();
  await expect(loading.getByText('AI가 메시지를 분석하고 있어요.')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('parent-message-analysis.png'), fullPage: true });
  await expect(page.getByRole('button', { name: 'AI 분석 시작', exact: true })).toHaveCount(0);
  expect(await page.locator('.parent-analysis-illustration').evaluate((image) => (
    (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0
  ))).toBe(true);
  await page.getByRole('button', { name: '문의 작성으로 돌아가기', exact: true }).click();
  await expect(page.getByLabel('문의 제목', { exact: true })).toHaveValue('상담 일정을 문의드립니다.');
  await expect(page.getByLabel('문의 내용', { exact: true })).toBeFocused();

  await page.getByRole('button', { name: 'AI 분석 시작', exact: true }).click();
  await expect(loading).toBeVisible();
  await expect(page).toHaveURL(/\/parent\/messages\/[^/]+\/review$/);
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), draftKey);
  expect(saved.status).toBe('PARENT_REVIEW');
  expect(saved.body).toContain('다음 주 상담');
});

test('저장 실패와 오프라인 상태에서 작성한 내용을 유지한다', async ({ page, context }) => {
  await openComposer(page);
  await fillMessage(page);
  await page.evaluate(() => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('teacher-hub.parent-message-draft.')) throw new DOMException('Quota exceeded', 'QuotaExceededError');
      originalSetItem.call(this, key, value);
    };
  });
  await page.getByRole('button', { name: '임시저장', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('임시저장하지 못했습니다. 다시 시도해 주세요.');
  await page.getByRole('button', { name: 'AI 분석 시작', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('작성한 내용을 저장하지 못했습니다. 다시 시도해 주세요.');
  await expect(page.getByLabel('문의 제목', { exact: true })).toHaveValue('상담 일정을 문의드립니다.');

  await context.setOffline(true);
  await page.getByRole('button', { name: 'AI 분석 시작', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('인터넷 연결을 확인한 후 다시 시도해 주세요.');
  await expect(page.getByRole('region', { name: '메시지 분석 중' })).toHaveCount(0);
});

test('학부모 메뉴와 계정 정보를 표시하고 화면이 가로로 넘치지 않는다', async ({ page }, testInfo) => {
  await openComposer(page);
  const isMobile = page.viewportSize()!.width <= 980;
  if (isMobile) {
    await page.getByRole('button', { name: '학부모 메뉴 더보기', exact: true }).click();
    const menu = page.getByRole('dialog', { name: 'Parent Hub 학부모 메뉴', exact: true });
    await expect(menu.getByRole('link', { name: '새 문의', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(menu.getByRole('link', { name: '문의 내역', exact: true })).toBeVisible();
    await menu.getByRole('button', { name: '계정 정보', exact: true }).click();
  } else {
    await expect(page.locator('.sidebar-shell')).toHaveCSS('width', '297px');
    await page.getByRole('button', { name: '사이드바 접기', exact: true }).click();
    await expect(page.locator('.sidebar-shell')).toHaveCSS('width', '100px');
    await page.getByRole('button', { name: '계정 정보', exact: true }).click();
  }
  const account = page.getByRole('dialog', { name: '계정 정보', exact: true });
  await expect(account.getByText('parent@example.com', { exact: true })).toBeVisible();
  await account.getByRole('button', { name: '닫기', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('parent-message-write.png'), fullPage: true });
});

test('다른 계정의 임시저장 내용과 손상된 데이터를 불러오지 않는다', async ({ page }) => {
  await openComposer(page);
  await page.evaluate(() => {
    localStorage.setItem('teacher-hub.parent-message-draft.999', JSON.stringify({
      messageId: 'other-parent', teacherId: 'teacher-102', title: '다른 학부모의 문의', body: '비공개 내용', status: 'DRAFT',
    }));
    localStorage.setItem('teacher-hub.parent-message-draft.101', '{broken');
  });
  await page.reload();
  await expect(page.getByLabel('문의 제목', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('문의 내용', { exact: true })).toHaveValue('');
});
