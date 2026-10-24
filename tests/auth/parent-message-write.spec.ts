import { expect, test, type Locator, type Page } from '@playwright/test';

const draftKey = 'teacher-hub.parent-message-draft.101';

async function openComposer(page: Page) {
  await page.goto('/login?role=PARENT');
  await page.locator('input[name="email"]').fill('parent@example.com');
  await page.locator('input[name="password"]').fill('password123');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page).toHaveURL(/\/parent\/messages\/new$/);
  await expect(page.getByRole('heading', { name: '새 문의 작성', exact: true })).toBeVisible();
}

async function fillMessage(page: Page) {
  await page.getByLabel('문의 제목', { exact: true }).fill('상담 일정을 문의드립니다.');
  await page.getByLabel('문의 내용', { exact: true }).fill('선생님 안녕하세요. 다음 주 상담 가능한 시간을 알려 주실 수 있을까요?');
}

async function expectMenuLabelsAligned(labels: Locator) {
  await expect(labels).toHaveCount(3);
  const positions = await labels.evaluateAll((elements) => elements.map((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    return range.getBoundingClientRect().left;
  }));
  for (const position of positions) expect(position).toBeCloseTo(positions[0], 1);
}

test('학부모 홈과 잘못된 경로는 새 문의로 연결되고 뒤로가기는 문의 내역을 연다', async ({ page }) => {
  await openComposer(page);
  for (const pathname of ['/parent', '/parent/unknown']) {
    await page.goto(pathname);
    await expect(page).toHaveURL(/\/parent\/messages\/new$/);
    await expect(page.getByRole('heading', { name: '새 문의 작성', exact: true })).toBeVisible();
    await expect(page.getByRole('navigation', { name: '현재 위치', exact: true }).getByRole('link', { name: '홈', exact: true })).toHaveAttribute('href', '/parent');
  }
  await page.getByRole('button', { name: '문의 내역으로 돌아가기', exact: true }).click();
  await expect(page).toHaveURL(/\/parent\/messages$/);
  await expect(page.getByRole('heading', { name: '문의 내역', exact: true })).toBeVisible();
  if (page.viewportSize()!.width <= 980) {
    await page.getByRole('button', { name: '학부모 메뉴 더보기', exact: true }).click();
    await page.getByRole('dialog', { name: 'Teacher Hub 학부모 메뉴', exact: true }).getByRole('link', { name: '새 문의', exact: true }).click();
  } else {
    await page.getByRole('link', { name: '새 문의', exact: true }).click();
  }
  await expect(page).toHaveURL(/\/parent\/messages\/new$/);
});

test('320px 화면에서도 제목과 breadcrumb가 헤더 안에 겹치지 않고 표시된다', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await openComposer(page);
  const header = page.locator('.parent-write-header');
  const heading = page.locator('.parent-write-heading');
  const breadcrumb = page.getByRole('navigation', { name: '현재 위치', exact: true });
  const currentPage = breadcrumb.locator('[aria-current="page"]');
  await expect(currentPage).toHaveText('새 문의 작성');
  await expect(currentPage).toHaveCSS('text-overflow', 'ellipsis');

  for (const width of [320, 375, 620]) {
    await page.setViewportSize({ width, height: 720 });
    const headerBox = (await header.boundingBox())!;
    const headingBox = (await heading.boundingBox())!;
    const breadcrumbBox = (await breadcrumb.boundingBox())!;
    expect(breadcrumbBox.x).toBeGreaterThanOrEqual(headingBox.x + headingBox.width);
    expect(breadcrumbBox.x + breadcrumbBox.width).toBeLessThanOrEqual(headerBox.x + headerBox.width + 1);
    expect(breadcrumbBox.y).toBeLessThan(headingBox.y + headingBox.height);
    expect(breadcrumbBox.y + breadcrumbBox.height).toBeGreaterThan(headingBox.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 320, height: 720 });
  await page.screenshot({ path: testInfo.outputPath('parent-message-write-320.png'), fullPage: true });
});

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
    const menu = page.getByRole('dialog', { name: 'Teacher Hub 학부모 메뉴', exact: true });
    await expect(menu.getByRole('link', { name: '새 문의', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(menu.getByRole('link', { name: '문의 내역', exact: true })).toBeVisible();
    await expectMenuLabelsAligned(menu.locator('.sidebar-mobile-link > span'));
    await menu.getByRole('button', { name: '설정/도움말', exact: true }).click();
  } else {
    await expect(page.locator('.sidebar-shell')).toHaveCSS('width', '297px');
    await expectMenuLabelsAligned(page.locator('.sidebar-shell .sidebar-link-label'));
    await page.getByRole('button', { name: '사이드바 접기', exact: true }).click();
    await expect(page.locator('.sidebar-shell')).toHaveCSS('width', '100px');
    await page.getByRole('button', { name: '설정/도움말', exact: true }).click();
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
