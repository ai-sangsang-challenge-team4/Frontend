import { expect, test } from '@playwright/test';

test('모바일 홈은 햄버거 옆 로그인 버튼으로 바로 이동할 수 있다', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.landing-intro-splash')).toHaveCount(0, { timeout: 6000 });
  const header = page.locator('.topbar');
  const mobileLogin = header.locator('.topbar__mobile-login');

  if (page.viewportSize()!.width <= 760) {
    await expect(mobileLogin).toBeVisible();
    await expect(header.getByRole('button', { name: '메뉴 더보기', exact: true })).toBeVisible();
    await mobileLogin.click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(header.locator('.topbar__mobile-login')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '로그인', exact: true })).toBeVisible();
  } else {
    await expect(mobileLogin).toBeHidden();
    await expect(header.getByRole('link', { name: '로그인', exact: true })).toBeVisible();
  }
});

test('공개 헤더는 모바일 메뉴와 데스크톱 버튼을 화면 크기에 맞게 표시한다', async ({ page }) => {
  for (const path of ['/login', '/signup', '/forgot-password']) {
    await page.goto(path);
    const header = page.locator('.topbar');
    const toggle = header.getByRole('button', { name: '메뉴 더보기', exact: true });
    const desktopNavigation = header.getByRole('navigation', { name: '공개 메뉴', exact: true });
    const isMobile = page.viewportSize()!.width <= 760;

    await expect(header.getByRole('link', { name: 'Teacher Hub', exact: true })).toBeVisible();
    if (isMobile) {
      await expect(toggle).toBeVisible();
      await expect(desktopNavigation).toBeHidden();
      await toggle.click();
      const dialog = page.getByRole('dialog', { name: 'Teacher Hub 공개 메뉴', exact: true });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('link', { name: '회원가입', exact: true })).toBeVisible();
      await expect(dialog.getByRole('link', { name: '로그인', exact: true })).toBeVisible();
      await dialog.getByRole('button', { name: '닫기', exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await expect(toggle).toBeFocused();
    } else {
      await expect(toggle).toBeHidden();
      await expect(desktopNavigation.getByRole('link', { name: '회원가입', exact: true })).toBeVisible();
      await expect(desktopNavigation.getByRole('link', { name: '로그인', exact: true })).toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  }
});

test('모바일 공개 메뉴는 이동 후 닫히고 키보드와 화면 크기 변경을 처리한다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');
  const toggle = page.getByRole('button', { name: '메뉴 더보기', exact: true });
  const dialog = page.getByRole('dialog', { name: 'Teacher Hub 공개 메뉴', exact: true });

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('link', { name: '로그인', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('link', { name: 'Teacher Hub', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toBeFocused();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');

  await toggle.click();
  await dialog.getByRole('link', { name: '회원가입', exact: true }).click();
  await expect(page).toHaveURL(/\/signup$/);
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '학부모 회원가입', exact: true })).toBeVisible();

  await toggle.click();
  await dialog.getByRole('link', { name: '로그인', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');

  await toggle.click();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(dialog).toHaveCount(0);
  await expect(toggle).toBeHidden();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});
