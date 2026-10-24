import { expect, test } from '@playwright/test';

test('존재하지 않는 주소는 공통 404 화면을 보여주고 홈으로 이동한다', async ({ page }) => {
  await page.goto('/unknown-page');

  const fallback = page.getByRole('alert');
  await expect(fallback.getByRole('heading', { name: '페이지를 찾을 수 없어요.' })).toBeVisible();
  await expect(fallback).toContainText('요청하신 페이지가 삭제되었거나 주소가 변경되었을 수 있어요.');
  await expect(fallback).toContainText('404');

  await fallback.getByRole('button', { name: '홈으로' }).click();
  await expect(page).toHaveURL(/\/$/);
});
