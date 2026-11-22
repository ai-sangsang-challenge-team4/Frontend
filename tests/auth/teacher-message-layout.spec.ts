import { expect, test, type Page } from '@playwright/test';

async function expectContentFits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const outside = await page.locator([
    '.board-reply-bubble', '.board-moderation-card', '.board-answer-box',
    '.board-reply-compose-panel', '.board-reply-bottom-actions button', '.board-reply-check-panel',
    '.board-answer-button-group', '.board-analysis-evidence-button', '.ai-judgment-notice--inline',
  ].join(',')).evaluateAll((elements) => elements.filter((element) => {
    const box = element.getBoundingClientRect();
    return box.width > 0 && (box.left < -1 || box.right > innerWidth + 1);
  }).map((element) => element.className));
  expect(outside).toEqual([]);
}

async function expectConversationFlow(page: Page) {
  const conversation = page.locator('.board-conversation');
  await expect(conversation).toBeVisible();
  const layout = await conversation.evaluate((element) => {
    const cta = element.querySelector('.board-answer-box')!;
    const lastMessage = cta.previousElementSibling!;
    return {
      gap: cta.getBoundingClientRect().top - lastMessage.getBoundingClientRect().bottom,
      hiddenHeight: element.scrollHeight - element.clientHeight,
      minHeight: parseFloat(getComputedStyle(element).minHeight),
    };
  });
  expect(layout.gap).toBeGreaterThanOrEqual(20);
  expect(layout.gap).toBeLessThanOrEqual(32);
  expect(layout.minHeight).toBeGreaterThanOrEqual(200);
  expect(layout.minHeight).toBeLessThanOrEqual(260);
  expect(layout.hiddenHeight).toBeLessThanOrEqual(1);
  await expectContentFits(page);
}

test('분석 대기 하단은 중복 안내 없이 제목과 버튼을 간결하게 배치한다', async ({ page }, testInfo) => {
  await page.goto('/login?role=TEACHER');
  await page.locator('input[name="email"]').fill('teacher@example.com');
  await page.locator('input[name="password"]').fill('password123');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page).toHaveURL(/\/teacher(?:\/messages)?$/);
  await page.goto('/teacher/messages/thread-003');
  await page.evaluate(async () => {
    const url = performance.getEntriesByType('resource').map((entry) => entry.name)
      .find((path) => /\/mockThreads\.ts(?:\?|$)/.test(path));
    if (!url) throw new Error('Mock thread module not found');
    const { initialTeacherThreads } = await import(url);
    delete initialTeacherThreads.find((thread: { id: string }) => thread.id === 'thread-003').analysis;
  });
  const tabs = page.getByRole('navigation', { name: '메시지 상세 탭' });
  await tabs.getByRole('button', { name: '처리 기록', exact: true }).click();
  await tabs.getByRole('button', { name: '대화', exact: true }).click();
  await expect(page.locator('.board-parent-card')).toContainText('분석 대기');
  const footer = page.locator('.board-answer-box');
  await expect(footer).toContainText('답변이 필요한 문의입니다.');
  await expect(footer.locator('.ui-badge, .board-answer-ai-note')).toHaveCount(0);
  await expect(footer).not.toContainText(/미답변|AI 분석이 아직 완료되지 않았습니다|AI 분석을 완료하지 못했습니다/);
  const evidence = footer.getByRole('button', { name: 'AI 분석 근거', exact: true });
  const compose = footer.getByRole('button', { name: '답변 작성', exact: true });
  await expect(evidence).toBeDisabled();
  await expect(compose).toBeEnabled();
  for (const width of testInfo.project.name === 'mobile' ? [375] : [1440, 1024, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await expectContentFits(page);
    const boxes = await footer.evaluate((element) => {
      const title = element.querySelector('.board-answer-cta-copy')!.getBoundingClientRect();
      const secondary = element.querySelector('.board-analysis-evidence-button')!.getBoundingClientRect();
      const primary = element.querySelector('.board-reply-compose-button')!.getBoundingClientRect();
      return { height: element.getBoundingClientRect().height, titleBottom: title.bottom,
        centerOffset: Math.abs(title.top + title.height / 2 - primary.top - primary.height / 2),
        primaryTop: primary.top, secondaryTop: secondary.top, primaryHeight: primary.height,
        secondaryHeight: secondary.height, buttonGap: primary.left - secondary.right };
    });
    expect(boxes.height).toBeLessThanOrEqual(width === 375 ? 140 : 100);
    expect(boxes.primaryTop).toBeCloseTo(boxes.secondaryTop, 0);
    expect(boxes.primaryHeight).toBeCloseTo(boxes.secondaryHeight, 0);
    expect(boxes.primaryHeight).toBeGreaterThanOrEqual(44);
    expect(boxes.buttonGap).toBeCloseTo(12, 0);
    if (width > 620) expect(boxes.centerOffset).toBeLessThan(1);
    else expect(boxes.titleBottom).toBeLessThanOrEqual(boxes.primaryTop);
    await footer.screenshot({ path: testInfo.outputPath(`pending-footer-${width}.png`), animations: 'disabled' });
  }
  await compose.click();
  await expect(page).toHaveURL(/thread-003\/response$/);
  await expect(page.getByLabel('선생님 답변', { exact: true })).toBeVisible();
});

for (const width of [1440, 1024, 768, 375]) {
  test(`${width}px에서 짧고 긴 대화와 작성 참고사항의 흐름을 유지한다`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== (width === 375 ? 'mobile' : 'desktop'));
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/login?role=TEACHER');
    await page.locator('input[name="email"]').fill('teacher@example.com');
    await page.locator('input[name="password"]').fill('password123');
    await page.getByRole('button', { name: '로그인', exact: true }).click();
    await expect(page).toHaveURL(/\/teacher(?:\/messages)?$/);
    await page.goto('/teacher/messages/thread-003');
    await expectConversationFlow(page);
    await expect(page.locator('.board-conversation-tools')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '메시지 표시 안내', exact: true })).toHaveCount(0);
    const evidence = page.getByRole('button', { name: 'AI 분석 근거', exact: true });
    await expect(evidence).toHaveCount(1);
    await expect(evidence).toBeVisible();
    await expect(page.locator('.board-answer-button-group').getByRole('button')).toHaveCount(2);
    await expect(evidence.locator('svg')).toHaveCount(0);
    await expect(page.locator('.board-answer-cta-copy p')).toHaveCount(0);
    await expect(page.locator('.board-answer-box .ui-badge')).toHaveCount(0);
    const aiHelp = page.getByRole('button', { name: 'AI 판단 및 답변 검토 안내', exact: true });
    await aiHelp.scrollIntoViewIfNeeded();
    await aiHelp.focus();
    const tooltip = page.getByRole('tooltip');
    await expect(tooltip).toContainText('최종 판단과 답변 검토·수정·전송은 교사가 직접 수행해야 합니다.');
    const tipBox = (await tooltip.boundingBox())!;
    const ctaBox = (await page.getByRole('button', { name: '답변 작성', exact: true }).boundingBox())!;
    expect(tipBox.x).toBeGreaterThanOrEqual(0);
    expect(tipBox.x + tipBox.width).toBeLessThanOrEqual(width);
    expect(tipBox.y + tipBox.height <= ctaBox.y || tipBox.y >= ctaBox.y + ctaBox.height ||
      tipBox.x + tipBox.width <= ctaBox.x || tipBox.x >= ctaBox.x + ctaBox.width).toBe(true);
    const noteBox = (await page.locator('.board-answer-ai-note').boundingBox())!;
    const titleBox = (await page.getByText('답변이 필요한 문의입니다.', { exact: true }).boundingBox())!;
    const evidenceBox = (await evidence.boundingBox())!;
    expect(evidenceBox.y).toBeCloseTo(ctaBox.y, 0);
    expect(evidenceBox.height).toBeCloseTo(ctaBox.height, 0);
    expect(ctaBox.x - evidenceBox.x - evidenceBox.width).toBeCloseTo(12, 0);
    expect(evidenceBox.width).toBeCloseTo(ctaBox.width, 0);
    await expect(evidence).toHaveCSS('font-size', '16px');
    await expect(page.locator('.board-reply-compose-button')).toHaveCSS('font-size', '16px');
    const copyBox = (await page.locator('.board-answer-cta-copy').boundingBox())!;
    if (width > 620) {
      expect(copyBox.x + copyBox.width).toBeLessThanOrEqual(evidenceBox.x);
      expect(Math.abs(copyBox.y + copyBox.height / 2 - ctaBox.y - ctaBox.height / 2)).toBeLessThan(1);
    } else {
      expect(titleBox.y + titleBox.height).toBeLessThanOrEqual(noteBox.y);
      expect(noteBox.y + noteBox.height).toBeLessThanOrEqual(ctaBox.y);
    }
    expect(ctaBox.height).toBeGreaterThanOrEqual(44);
    await page.keyboard.press('Escape');
    await aiHelp.blur();
    if (width > 375) {
      await aiHelp.hover();
      await expect(tooltip).toContainText('AI 분석과 답변 초안');
      await page.keyboard.press('Escape');
      await page.mouse.move(0, 0);
    } else {
      await aiHelp.tap();
      await expect(tooltip).toContainText('AI 분석과 답변 초안');
      await aiHelp.tap();
      await expect(tooltip).toHaveCount(0);
    }
    const shortHeight = (await page.locator('.board-conversation').boundingBox())!.height;
    expect(shortHeight).toBeLessThan(width === 375 ? 700 : 500);
    await page.locator('.board-conversation').screenshot({ path: testInfo.outputPath('short-conversation.png') });

    // Extend the existing mock conversation without changing risk or permission data.
    await page.evaluate(async () => {
      const url = performance.getEntriesByType('resource').map((entry) => entry.name)
        .find((path) => /\/mockThreads\.ts(?:\?|$)/.test(path));
      if (!url) throw new Error('Mock thread module not found');
      const { initialTeacherThreads } = await import(url);
      const thread = initialTeacherThreads.find((item: { id: string }) => item.id === 'thread-003');
      const first = thread.replies[0];
      for (let i = 0; i < 12; i++) thread.replies.push({
        ...first, id: `layout-reply-${i}`, authorRole: i % 2 === 0 ? 'teacher' : 'parent',
        content: `${i + 1}번째 대화입니다. ${'확인한 내용을 함께 안내드립니다. '.repeat(8)}`,
      });
    });
    const tabs = page.getByRole('navigation', { name: '메시지 상세 탭' });
    await tabs.getByRole('button', { name: '처리 기록', exact: true }).click();
    await tabs.getByRole('button', { name: '대화', exact: true }).click();
    await expect(page.locator('.board-reply')).toHaveCount(13);
    await expectConversationFlow(page);
    expect((await page.locator('.board-conversation').boundingBox())!.height).toBeGreaterThan(900);
    await page.getByRole('button', { name: /^답변 (작성|이어서 작성하기)$/ }).click();
    await expect(page).toHaveURL(/thread-003\/response$/);
    const editor = page.getByLabel('선생님 답변', { exact: true });
    await editor.fill('화면을 조정해도 보존되어야 하는 작성 중 답변입니다.');
    const composerHeader = page.locator('.board-reply-compose-header');
    await expect(composerHeader.getByRole('button', { name: 'AI 분석 근거', exact: true })).toHaveCount(1);
    await expect(page.locator('.board-conversation .board-analysis-evidence-button, .board-conversation .board-conversation-evidence-actions')).toHaveCount(0);
    expect(await page.locator('.board-conversation').evaluate((element) =>
      element.getBoundingClientRect().bottom - element.lastElementChild!.getBoundingClientRect().bottom)).toBeCloseTo(24, 0);
    const close = composerHeader.getByRole('button', { name: '답변 작성 닫기', exact: true });
    await expect(close).toHaveText('닫기');
    await expect(close.locator('svg')).toHaveAttribute('aria-hidden', 'true');
    await expect(close.locator('svg')).toHaveCSS('width', '14px');
    await expect(close.locator('svg')).toHaveCSS('height', '14px');
    await expect(close).toHaveCSS('gap', '8px');
    await expect(evidence.locator('.ui-button-icon')).toHaveCount(0);
    const labelBox = (await composerHeader.locator('label').boundingBox())!;
    const statusBox = (await composerHeader.locator('[aria-live="polite"]').boundingBox())!;
    const closeBox = (await close.boundingBox())!;
    const headerBox = (await composerHeader.boundingBox())!;
    const headerEvidenceBox = (await evidence.boundingBox())!;
    expect(closeBox.width).toBeLessThan(headerEvidenceBox.width);
    const titleGroupBox = (await composerHeader.locator('.board-reply-compose-title').boundingBox())!;
    expect(Math.abs(closeBox.x + closeBox.width - headerBox.x - headerBox.width)).toBeLessThan(1);
    expect(closeBox.y).toBeCloseTo(headerEvidenceBox.y, 0);
    expect(closeBox.height).toBeCloseTo(headerEvidenceBox.height, 0);
    expect(closeBox.height).toBeGreaterThanOrEqual(47);
    expect(closeBox.x - headerEvidenceBox.x - headerEvidenceBox.width).toBeCloseTo(12, 0);
    if (width > 620) {
      expect(titleGroupBox.x + titleGroupBox.width).toBeLessThanOrEqual(headerEvidenceBox.x);
      if (statusBox.y < labelBox.y + labelBox.height) {
        expect(statusBox.x - labelBox.x - labelBox.width).toBeCloseTo(12, 0);
      } else expect(statusBox.y).toBeGreaterThanOrEqual(labelBox.y + labelBox.height);
    } else {
      expect(statusBox.y).toBeGreaterThanOrEqual(labelBox.y + labelBox.height);
      expect(headerEvidenceBox.y).toBeGreaterThanOrEqual(titleGroupBox.y + titleGroupBox.height);
    }
    expect((await editor.boundingBox())!.height).toBeGreaterThanOrEqual(260);
    await expect(page.locator('.ai-judgment-notice:not(.ai-judgment-notice--inline)')).toHaveCount(0);
    await expect(page.locator('.board-reply-notices')).toHaveCount(0);
    await expect(editor).not.toHaveAttribute('aria-describedby');
    await expect(evidence).toHaveCount(1);
    const replyUrl = page.url();
    await evidence.click();
    await expect(page).toHaveURL(replyUrl);
    await expect(page.locator('.board-support-drawer')).toBeVisible();
    await page.getByRole('button', { name: '상세 정보 닫기', exact: true }).click();
    await expect(editor).toHaveValue('화면을 조정해도 보존되어야 하는 작성 중 답변입니다.');
    const panel = page.locator('.board-reply-check-panel');
    const toggle = panel.getByRole('button', { name: /^(자세히 보기|접기)$/ });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.board-reply-check-content')).toHaveCount(0);
    const composerBox = (await page.locator('.board-reply-compose-panel').boundingBox())!;
    expect((await panel.boundingBox())!.y).toBeGreaterThanOrEqual(composerBox.y + composerBox.height);
    await expectContentFits(page);
    await page.locator('.board-reply-composer').screenshot({ path: testInfo.outputPath('composer-collapsed.png') });
    await toggle.focus();
    await toggle.press('Space');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(panel.getByText('주의 포인트', { exact: true })).toBeVisible();
    await expectContentFits(page);
    await panel.screenshot({ path: testInfo.outputPath('references-expanded.png') });
    await toggle.click();
    await expect(editor).toHaveValue('화면을 조정해도 보존되어야 하는 작성 중 답변입니다.');
    await close.focus();
    await close.press('Enter');
    await expect(page.locator('.board-reply-compose-panel')).toHaveCount(0);
    await expect(page).toHaveURL(/\/thread-003$/);
    await expect(evidence).toHaveCount(1);
    await expect(page.locator('.board-answer-button-group').getByRole('button', { name: 'AI 분석 근거', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '답변 이어서 작성하기', exact: true }).click();
    await expect(editor).toHaveValue('화면을 조정해도 보존되어야 하는 작성 중 답변입니다.');

    const longReply = '확인한 내용을 바탕으로 안내드립니다.\n'.repeat(60);
    const replyCount = await page.locator('.board-reply-teacher').count();
    await editor.fill(longReply);
    await page.getByRole('button', { name: '검토 후 전송', exact: true }).click();
    const confirm = page.getByRole('dialog', { name: '답변 전 확인', exact: true });
    const finalSend = confirm.getByRole('button', { name: '최종 전송', exact: true });
    const checkbox = confirm.getByRole('checkbox', { name: '답변 내용을 확인했으며, 전송에 동의합니다.' });
    await expect(confirm).toContainText('전송할 답변을 최종 확인해 주세요.');
    await expect(finalSend).toBeDisabled();
    await expect(page.locator('.board-reply-teacher')).toHaveCount(replyCount);
    const preview = confirm.locator('.board-send-confirm-preview p');
    expect(await preview.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
    await preview.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    await expect(checkbox).toBeInViewport();
    await expect(finalSend).toBeInViewport();
    const dialogBox = (await confirm.boundingBox())!;
    expect(dialogBox.x).toBeGreaterThanOrEqual(0);
    expect(dialogBox.x + dialogBox.width).toBeLessThanOrEqual(width);
    await checkbox.check();
    await expect(finalSend).toBeEnabled();
    await confirm.screenshot({ path: testInfo.outputPath(`send-confirm-${width}.png`) });
    await confirm.getByRole('button', { name: '취소', exact: true }).click();
    await expect(editor).toHaveValue(longReply);
    await page.getByRole('button', { name: '검토 후 전송', exact: true }).click();
    await expect(checkbox).not.toBeChecked();
    await expect(finalSend).toBeDisabled();
    await confirm.getByRole('button', { name: '취소', exact: true }).click();

    for (const id of ['thread-002', 'thread-004', 'thread-001']) {
      await page.goto(`/teacher/messages/${id}`);
      await expectConversationFlow(page);
      if (id === 'thread-001') {
        await expect(page.locator('.board-answer-box.is-locked')).toBeVisible();
        await expect(page.getByRole('button', { name: /^답변 (작성|이어서 작성하기)$/ })).toHaveCount(0);
      }
    }
  });
}
