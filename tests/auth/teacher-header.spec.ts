import { expect, test, type Page } from '@playwright/test';

const teacherPages = [
  { path: '/teacher/messages', title: '받은 메시지', label: '메시지' },
  { path: '/teacher/guide', title: '대응 가이드', label: '대응 가이드' },
  { path: '/teacher/admin-share', title: '관리자 공유', label: '관리자 공유' },
  { path: '/teacher/settings', title: '설정/도움말', label: '설정/도움말' },
];

async function loginTeacher(page: Page) {
  await page.goto('/login?role=TEACHER');
  await page.locator('input[name="email"]').fill('teacher@example.com');
  await page.locator('input[name="password"]').fill('password123');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page).toHaveURL(/\/teacher\/messages$/);
  await expect(page.getByRole('heading', { name: '받은 메시지', exact: true })).toBeVisible();
}

test('교사 화면은 모바일 햄버거 메뉴와 데스크톱 사이드바를 표시한다', async ({ page }) => {
  await loginTeacher(page);
  const isMobile = page.viewportSize()!.width <= 980;

  for (const { path, title, label } of teacherPages) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: title, exact: true }).first()).toBeVisible();
    const toggle = page.getByRole('button', { name: '교사 메뉴 더보기', exact: true });

    if (isMobile) {
      await expect(toggle).toBeVisible();
      const headerGap = await page.locator('.sidebar-shell').evaluate((sidebar) => (
        sidebar.nextElementSibling!.getBoundingClientRect().top -
        sidebar.getBoundingClientRect().bottom
      ));
      expect(headerGap).toBeCloseTo(0, 1);
      await expect(page.locator('.sidebar-shell > .sidebar-nav')).toBeHidden();
      await expect(page.getByRole('button', { name: '로그아웃', exact: true })).toHaveCount(0);
      await toggle.click();
      const dialog = page.getByRole('dialog', { name: 'Teacher Hub 교사 메뉴', exact: true });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('link', { name: label, exact: true })).toHaveAttribute('aria-current', 'page');
      await expect(dialog.getByText('teacher@example.com', { exact: true })).toBeVisible();
      await expect(dialog.getByRole('button', { name: '로그아웃', exact: true })).toBeVisible();
      await dialog.getByRole('button', { name: '닫기', exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await expect(toggle).toBeFocused();
    } else {
      await expect(toggle).toBeHidden();
      await expect(page.locator('.sidebar-shell > .sidebar-nav')).toBeVisible();
      await expect(page.getByRole('button', { name: '사이드바 접기', exact: true })).toBeVisible();
    }
  }
});

test('교사 모바일 메뉴는 이동, 키보드 닫기, 화면 크기 전환, 로그아웃을 처리한다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginTeacher(page);
  const toggle = page.getByRole('button', { name: '교사 메뉴 더보기', exact: true });
  const dialog = page.getByRole('dialog', { name: 'Teacher Hub 교사 메뉴', exact: true });

  await toggle.click();
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(toggle).toBeFocused();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');

  for (const { path, title, label } of teacherPages.slice(1)) {
    await toggle.click();
    await dialog.getByRole('link', { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('heading', { name: title, exact: true }).first()).toBeVisible();
    await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  }

  await toggle.click();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(dialog).toHaveCount(0);
  await expect(toggle).toBeHidden();
  await expect(page.locator('.sidebar-shell > .sidebar-nav')).toBeVisible();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');

  await toggle.click();
  await dialog.getByRole('link', { name: '대응 가이드', exact: true }).click();
  await expect(page).toHaveURL(/\/teacher\/guide$/);
  await toggle.click();
  await dialog.getByRole('button', { name: '로그아웃', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  expect(await page.evaluate(() => localStorage.getItem('teacher-hub.auth-session'))).toBeNull();
});
