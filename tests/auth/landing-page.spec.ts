import { expect, test } from '@playwright/test';

test('shows the intro only once per tab across navigation and reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.landing-intro-splash')).toBeVisible();
  await expect(page.locator('.landing-intro-splash')).toHaveCount(0, { timeout: 6000 });

  await page.getByRole('link', { name: '학부모 로그인', exact: true }).click();
  await expect(page).toHaveURL(/\/login\?role=PARENT$/);
  await page.getByRole('link', { name: 'Teacher Hub', exact: true }).click();
  await expect(page.locator('.landing-page')).toBeVisible();
  expect(await page.locator('.landing-intro-splash').count()).toBe(0);
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');

  for (const selector of [
    '.landing-intro__grid',
    '.landing-features .landing-section-heading',
    '.landing-workflow .landing-section-heading',
  ]) {
    const section = page.locator(selector);
    await section.scrollIntoViewIfNeeded();
    await expect(section).toHaveCSS('opacity', '1');
  }

  await page.reload();
  await expect(page.locator('.landing-page')).toBeVisible();
  expect(await page.locator('.landing-intro-splash').count()).toBe(0);
  await expect(page.locator('.landing-main-content')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
});

test('shows the supplied screenshots in their matching workflow steps', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.landing-intro-splash')).toHaveCount(0, { timeout: 6000 });

  for (const [title, asset] of [
    ['메시지 확인', 'workflow-message'],
    ['AI 분석', 'workflow-analysis'],
    ['답변 작성', 'workflow-reply'],
  ]) {
    const card = page.locator('.landing-step-card').filter({
      has: page.getByRole('heading', { name: title, exact: true }),
    });
    const image = card.getByRole('img', { name: `${title} 화면`, exact: true });
    await image.scrollIntoViewIfNeeded();
    await expect(image).toBeVisible();
    await expect(image).toHaveAttribute('src', new RegExp(asset));
    await expect.poll(() => image.evaluate((element: HTMLImageElement) =>
      element.complete && element.naturalWidth === 980 && element.naturalHeight === 540,
    )).toBe(true);
  }

  await expect(page.locator('.landing-preview')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
});
