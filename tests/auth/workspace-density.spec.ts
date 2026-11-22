import { expect, test, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

async function login(page: Page, role: 'TEACHER' | 'PARENT' | 'ADMIN') {
  if (page.url() !== 'about:blank') await page.evaluate(() => localStorage.removeItem('teacher-hub.auth-session'));
  await page.goto(`/login?role=${role}`);
  await page.locator('input[name="email"]').fill(role === 'ADMIN' ? 'admin@teacherhub.local' : `${role.toLowerCase()}@example.com`);
  await page.locator('input[name="password"]').fill(role === 'ADMIN' ? 'admin1234' : 'password123');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

for (const width of [1440, 1024, 768, 375]) {
  test(`${width}px 업무 화면은 내용을 자르지 않고 주요 작업에 접근할 수 있다`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== (width === 375 ? 'mobile' : 'desktop'));
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 900 });
    const metrics: Record<string, unknown> = {};
    async function inspect(name: string, selector: string) {
      await expect(page.locator(selector).first()).toBeVisible();
      await page.locator('img').evaluateAll((images) => Promise.all(images.map((image) => (image as HTMLImageElement).decode().catch(() => undefined))));
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      metrics[name] = await page.locator(selector).first().evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { x: rect.x, y: rect.y, height: rect.height, width: rect.width, font: getComputedStyle(element).fontSize };
      });
      await page.screenshot({ path: testInfo.outputPath(`${name}.png`), animations: 'disabled' });
    }
    await login(page, 'TEACHER');
    await page.goto('/teacher/messages');
    await inspect('teacher-list', '.board-thread-row');
    if (width === 1440) {
      expect((await page.locator('.board-thread-row').first().boundingBox())!.height).toBeLessThanOrEqual(90);
    }
    expect((await page.locator('.board-thread-star-button').first().boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const search = page.getByRole('searchbox', { name: '메시지 검색', exact: true });
    await search.focus();
    await expect(search.locator('..')).toHaveCSS('border-color', 'rgb(59, 91, 219)');
    await expect(search.locator('..')).toHaveCSS('min-height', '47px');
    await page.goto('/teacher/messages/thread-003');
    await inspect('teacher-detail', '.board-parent-card');
    await expect(page.locator('.board-card-topic')).not.toBeEmpty();
    await page.getByRole('button', { name: '답변 작성', exact: true }).click();
    await expect(page.getByLabel('선생님 답변', { exact: true })).toBeEditable();
    await inspect('teacher-reply', '.board-reply-compose-panel');
    await expect(page.getByLabel('선생님 답변', { exact: true })).toHaveCSS('font-size', '16px');
    await page.getByLabel('선생님 답변', { exact: true }).fill('문의 내용을 확인하고 답변을 준비하고 있습니다.');
    await page.goto('/teacher/guide');
    await inspect('guide', '.guide-board-row');
    await expect(page.locator('.guide-board-head > span')).toHaveText(['번호', '제목']);
    await page.goto('/teacher/admin-share');
    await inspect('teacher-share', '.teacher-admin-share-panel');

    await login(page, 'PARENT');
    await inspect('parent-new', '.parent-write-form');
    await page.evaluate(() => localStorage.setItem('teacher-hub.parent-sent-messages.101', JSON.stringify([{
      messageId: 'density', teacherId: 'teacher-102', teacherName: '김OO 선생님',
      title: '현장체험학습 준비물과 일정 확인 문의', originalBody: '준비물과 출발 시간을 확인하고 싶습니다.',
      finalBody: '준비물과 출발 시간을 확인하고 싶습니다.', selectionType: 'ORIGINAL', selectionSource: 'ORIGINAL',
      status: 'SENT', sentAt: '2026-08-10T10:00:00+09:00', consultationStatus: 'before', auditLog: [],
    }])));
    await page.goto('/parent/messages');
    await inspect('parent-list', '.parent-inquiry-link');
    await page.locator('.parent-history-link').first().click();
    await inspect('parent-detail', '.parent-conversation-messages');
    await expect(page.getByRole('button', { name: '추가 문의하기', exact: true })).toBeVisible();
    if (width > 980) {
      expect((await page.locator('.parent-conversation-messages').boundingBox())!.height).toBeLessThan(400);
      await expect(page.getByRole('button', { name: '추가 문의하기', exact: true })).toBeInViewport();
    }
    // Text-only enlargement exercises wrapping without applying page zoom/scale.
    await page.addStyleTag({ content: '.parent-chat-bubble p { font-size: 32px; }' });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    await login(page, 'ADMIN');
    await inspect('admin-list', '.admin-list-panel');
    await writeFile(testInfo.outputPath('metrics.json'), JSON.stringify(metrics, null, 2));
    await testInfo.attach('layout-metrics', { body: JSON.stringify(metrics, null, 2), contentType: 'application/json' });
  });
}
