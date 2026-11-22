import { expect, test } from '@playwright/test';
import { continuesReplyGroup } from '../../src/features/message/conversationGrouping';
import type { BoardReply } from '../../src/features/message/types';

test('대화 그룹은 발신자·날짜·30분 경계를 지키며 불확실한 시간은 합치지 않는다', () => {
  const first: BoardReply = { id: 'a', authorRole: 'parent', authorName: '학부모', content: '원문', label: '', time: '', sentAt: '2026-11-21T17:01:00+09:00' };
  expect(continuesReplyGroup(first, { ...first, sentAt: '2026-11-21T17:31:00+09:00' })).toBe(true);
  for (const change of [
    { sentAt: '2026-11-21T17:31:01+09:00' }, { sentAt: '2026-11-21T17:00:59+09:00' },
    { sentAt: undefined }, { sentAt: 'invalid' }, { authorName: '다른 학부모' },
    { authorRole: 'teacher' as const },
  ]) expect(continuesReplyGroup(first, { ...first, ...change })).toBe(false);
  expect(continuesReplyGroup(undefined, first)).toBe(false);
  expect(continuesReplyGroup({ ...first, sentAt: '2026-11-21T23:55:00+09:00' },
    { ...first, sentAt: '2026-11-22T00:05:00+09:00' })).toBe(false);
});

test('상세 원래 제목과 연속 메시지의 프로필·시간·정렬을 유지한다', async ({ page }, testInfo) => {
  await page.goto('/login?role=TEACHER');
  await page.locator('input[name="email"]').fill('teacher@example.com');
  await page.locator('input[name="password"]').fill('password123');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page).toHaveURL(/\/teacher(?:\/messages)?$/);
  await page.goto('/teacher/messages/thread-003');
  const messages = [
    ['parent', '정하준 학부모', '2026-11-21T17:01:00+09:00', '선생님 안녕하세요'],
    ['parent', '정하준 학부모', '2026-11-21T17:21:00+09:00', '문의 내용을 추가합니다.'],
    ['parent', '정하준 학부모', '2026-11-21T17:51:00+09:00', '30분 뒤 추가 문의입니다.'],
    ['parent', '정하준 학부모', '2026-11-21T18:22:00+09:00', '새 그룹으로 확인할 문의입니다.'],
    ['teacher', '담임 선생님', '2026-11-21T18:23:00+09:00', '확인하겠습니다.'],
    ['parent', '정하준 학부모', '2026-11-21T23:55:00+09:00', '날짜가 바뀌기 전 문의입니다.'],
    ['parent', '정하준 학부모', '2026-11-22T00:05:00+09:00', '날짜가 바뀐 뒤 문의입니다. ' + '긴 메시지를 확인해 주세요. '.repeat(20)],
  ];
  await page.evaluate(async (messages) => {
    const url = performance.getEntriesByType('resource').map((entry) => entry.name).find((path) => /\/mockThreads\.ts(?:\?|$)/.test(path));
    if (!url) throw new Error('Mock threads unavailable');
    const { initialTeacherThreads } = await import(url);
    const thread = initialTeacherThreads.find((item: { id: string }) => item.id === 'thread-003');
    thread.title = '학부모가 작성한 원래 문의 제목';
    thread.conversationSummary = { topic: '자동 생성 제목', text: '자동 생성 요약' };
    thread.messageDateLabel = '2026년 11월 21일 토요일';
    thread.replies = messages.map(([authorRole, authorName, sentAt, content], index) => ({
      id: `group-${index}`, authorRole, authorName, sentAt, content, label: '', time: '',
    }));
  }, messages);
  const tabs = page.getByRole('navigation', { name: '메시지 상세 탭' });
  await tabs.getByRole('button', { name: '처리 기록', exact: true }).click();
  await tabs.getByRole('button', { name: '대화', exact: true }).click();
  const card = page.locator('.board-parent-card--detail');
  await expect(card.locator('.board-card-topic')).toHaveText('학부모가 작성한 원래 문의 제목');
  await expect(card).not.toContainText(/자동 생성|최근 수신/);
  await expect(card.locator('.board-avatar')).toBeVisible();
  await expect(card.locator('.board-card-profile')).toContainText('정하준 학부모');
  const replies = page.locator('.board-conversation .board-reply');
  await expect(replies).toHaveCount(messages.length);
  await expect(page.locator('.board-reply-parent .board-reply-author')).toHaveCount(4);
  await expect(replies.nth(1).locator('.board-reply-author')).toHaveCount(0);
  await expect(replies.nth(2).locator('.board-reply-author')).toHaveCount(0);
  await expect(page.locator('.board-date-chip')).toHaveText(['2026년 11월 21일 토요일', '2026년 11월 22일 일요일']);
  for (let index = 0; index < messages.length; index++) {
    await expect(replies.nth(index).locator('.board-reply-bubble p')).toHaveText(messages[index][3]);
    await expect(replies.nth(index).locator('time')).toHaveAttribute('datetime', messages[index][2]);
  }
  for (const width of testInfo.project.name === 'mobile' ? [375] : [1440, 1024, 768]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const [first, second] = await replies.locator('.board-reply-bubble').evaluateAll((elements) =>
      elements.slice(0, 2).map((element) => element.getBoundingClientRect().x));
    expect(first).toBeCloseTo(second, 0);
    const firstBox = (await replies.nth(0).boundingBox())!;
    const secondBox = (await replies.nth(1).boundingBox())!;
    expect(secondBox.y - firstBox.y - firstBox.height).toBeCloseTo(8, 0);
    const priorGroup = (await replies.nth(2).boundingBox())!;
    const nextGroup = (await replies.nth(3).boundingBox())!;
    expect(nextGroup.y - priorGroup.y - priorGroup.height).toBeCloseTo(24, 0);
    const timeBoxes = await replies.locator('time').evaluateAll((elements) => elements.map((element) => {
      const box = element.getBoundingClientRect(); return { left: box.left, right: box.right };
    }));
    for (const box of timeBoxes) { expect(box.left).toBeGreaterThanOrEqual(0); expect(box.right).toBeLessThanOrEqual(width); }
    await page.locator('.board-detail img').evaluateAll(async (elements) => {
      await Promise.all(elements.map((element) => (element as HTMLImageElement).decode()));
    });
    await card.screenshot({ path: testInfo.outputPath(`context-${width}.png`), animations: 'disabled' });
    await page.locator('.board-conversation').screenshot({ path: testInfo.outputPath(`grouped-${width}.png`), animations: 'disabled' });
    if (width <= 980) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: testInfo.outputPath(`page-${width}.png`), fullPage: true, animations: 'disabled' });
    }
  }
});
