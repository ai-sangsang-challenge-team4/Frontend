import { expect, test, type Page } from '@playwright/test';

async function login(page: Page, role: 'TEACHER' | 'PARENT') {
  if (page.url() !== 'about:blank') await page.evaluate(() => sessionStorage.removeItem('teacher-hub.auth-session'));
  await page.goto(`/login?role=${role}`);
  await page.locator('input[name="email"]').fill(role === 'TEACHER' ? 'teacher@example.com' : 'parent@example.com');
  await page.locator('input[name="password"]').fill('password123');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page).toHaveURL(role === 'TEACHER' ? /\/teacher(?:\/messages)?$/ : /\/parent\/messages\/new$/);
}

test('네 목록 검색창은 같은 크기와 키보드 포커스를 사용한다', async ({ page }, testInfo) => {
  const measurements: Array<{ name: string; height: number; radius: string; font: string; padding: string; placeholder: string; icon: number }> = [];
  for (const width of testInfo.project.name === 'desktop' ? [1440, 768] : [375]) {
    await page.setViewportSize({ width, height: 900 });
    await login(page, 'TEACHER');
    for (const [name, path, label] of [
      ['messages', '/teacher/messages', '메시지 검색'],
      ['guide', '/teacher/guide', '대응 가이드 검색'],
      ['share', '/teacher/admin-share', '민원 제목 또는 학생명'],
      ['parent', '/parent/messages', '문의 검색'],
    ]) {
      if (name === 'parent') await login(page, 'PARENT');
      await page.goto(path);
      const input = page.getByRole('searchbox', { name: label, exact: true });
      await expect(input).toBeVisible();
      await expect(input.locator('..').locator(':scope > :first-child')).toHaveClass('ui-field-icon');
      await expect(input.locator('..').locator(':scope > :last-child')).toHaveClass('ui-field-control');
      await input.scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`${name}-${width}.png`) });
      measurements.push(await input.evaluate((element, name) => {
        const shell = element.closest('.ui-input-shell')!;
        const style = getComputedStyle(shell);
        return { name, height: shell.getBoundingClientRect().height, radius: style.borderRadius,
          font: getComputedStyle(element).fontSize, padding: style.paddingLeft,
          placeholder: getComputedStyle(element, '::placeholder').color,
          icon: shell.querySelector('svg')?.getBoundingClientRect().width ?? 0 };
      }, `${name}-${width}`));
      await input.focus();
      await expect(input).toBeFocused();
      await expect(input.locator('..')).toHaveCSS('border-color', 'rgb(59, 91, 219)');
      await expect(input.locator('..')).not.toHaveCSS('box-shadow', 'none');
      await input.fill('검색 확인');
      await expect(input).toHaveValue('검색 확인');
      await input.fill('');
      await expect(input).toHaveValue('');
    }
  }
  for (const { name, ...measurement } of measurements) {
    expect(measurement, name).toEqual({ height: 47, radius: '8px', font: '16px', padding: '16px',
      placeholder: measurements[0].placeholder, icon: 20 });
  }
});

test('대응 가이드 두 열 목록은 긴 제목을 줄바꿈하고 검색과 상세 이동을 유지한다', async ({ page }, testInfo) => {
  await login(page, 'TEACHER');
  await page.goto('/teacher/guide');
  const board = page.getByRole('region', { name: '대응 가이드 게시글 목록', exact: true });
  await expect(board.locator('.guide-board-head > span')).toHaveText(['번호', '제목']);
  await expect(board.locator('time')).toHaveCount(0);
  await expect(board.locator('.guide-comment-count')).toHaveCount(0);
  await expect(board).not.toContainText(/\[\d+\]/);
  await expect(board.locator('.guide-notice-badge').first()).toBeVisible();
  const firstTitle = await board.locator('.guide-board-title').first().innerText();
  for (const width of [1440, 1024, 768, 375]) {
    await page.setViewportSize({ width, height: 900 });
    // Page widths and padding transition when crossing responsive breakpoints.
    await expect.poll(() => board.evaluate((element) => element.scrollWidth <= element.clientWidth), { message: `guide overflow at ${width}px` }).toBe(true);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), { message: `page overflow at ${width}px` }).toBe(true);
  }
  const search = page.getByRole('searchbox', { name: '대응 가이드 검색', exact: true });
  await search.fill('검색결과없음-검증');
  await expect(page.getByRole('heading', { name: '조건에 맞는 게시글이 없습니다', exact: true })).toBeVisible();
  await search.fill('');
  await expect(board.locator('.guide-board-title').first()).toHaveText(firstTitle);
  await board.getByRole('button').first().focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#guide-post-title')).toBeVisible();
  await expect(page.locator('.guide-post-date')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '확인 사항', exact: true })).toBeVisible();
  const before = await page.locator('#guide-post-title').innerText();
  await page.getByRole('button', { name: /다음글/ }).click();
  await expect(page.locator('#guide-post-title')).not.toHaveText(before);
  await page.getByRole('button', { name: /이전글/ }).click();
  await expect(page.locator('#guide-post-title')).toHaveText(before);
  await page.screenshot({ path: testInfo.outputPath('guide-detail.png'), fullPage: true });
  await page.getByRole('button', { name: '목록', exact: true }).click();
  await expect(board).toBeVisible();
  // Simulate text-only enlargement with the existing px font sizes.
  await page.addStyleTag({ content: '.guide-board-row { font-size: 40px; line-height: 1.5; }' });
  expect(await board.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await expect(board.getByRole('button').first()).toBeVisible();
});
