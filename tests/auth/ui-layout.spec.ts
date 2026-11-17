import { expect, test } from '@playwright/test';

test('교사 상세는 sidebar 경계와 긴 제목에서도 주제·메타를 유지하고 가로로 넘치지 않는다', async ({ page }) => {
  await page.goto('/login?role=TEACHER');
  await page.locator('input[name="email"]').fill('teacher@example.com');
  await page.locator('input[name="password"]').fill('password123');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page).toHaveURL(/\/teacher\/messages$/);
  await page.goto('/teacher/messages/thread-002');
  const topic = page.locator('.board-card-topic');
  await expect(topic).toBeVisible();
  await topic.locator('strong').evaluate((element) => { element.textContent = '긴 한국어 문의 제목과 상담 맥락을 확인합니다. '.repeat(12); });
  for (const width of [320, 375, 620, 621, 820, 980, 981, 1240, 1440]) {
    await page.setViewportSize({ width, height: 720 });
    await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), { message: `${width}px overflow` }).toBe(true);
    expect((await topic.boundingBox())!.width, `${width}px topic width`).toBeGreaterThan(100);
    await expect(page.getByRole('button', { name: 'AI 위험도 설명' })).toBeVisible();
  }
});
