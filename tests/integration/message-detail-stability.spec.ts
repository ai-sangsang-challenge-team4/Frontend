import { expect, test, type Page } from '@playwright/test';

// Real Chromium + HTTP adapters, with deterministic API responses (no production writes).
async function setupInbox(page: Page) {
  const user = { userId: 201, name: '테스트 교사', email: 'layout@example.com', role: 'TEACHER' };
  await page.addInitScript((user) => {
    localStorage.setItem('teacher-hub.auth-session', JSON.stringify({
      accessToken: 'layout-test-token', expiresAt: Date.now() + 3600_000, user,
    }));
  }, user);
  let release = () => {};
  let gate = Promise.resolve();
  let detailRequests = 0;
  let fail = false;
  const item = (id: number) => ({
    complaintId: id, title: `안정성 확인 문의 ${id}`, studentId: id, studentName: '테스트 학생',
    counterpartName: '테스트 학부모', counterpartRole: 'PARENT', academicYear: 2026,
    grade: 3, classNo: 1, status: 'OPEN', waitingFor: 'TEACHER', riskAnalysisId: id,
    riskLevel: 'LOW', aiSummary: '학교 일정에 관한 문의입니다.', latestReceivedAt: '2026-11-22T09:00:00',
  });
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const path = new URL(route.request().url()).pathname.slice(4);
    if (path === '/users/me') return route.fulfill({ json: user });
    if (path === '/teacher/complaints') return route.fulfill({ json: {
      content: Array.from({ length: 20 }, (_, i) => item(i + 1)), page: 0, size: 20,
      totalElements: 20, totalPages: 1, first: true, last: true, hasNext: false, hasPrevious: false,
    } });
    const match = path.match(/^\/teacher\/complaints\/(\d+)(?:\/(.*))?$/);
    if (!match) throw new Error(`Unexpected API request: ${route.request().method()} ${path}`);
    const id = Number(match[1]);
    const resource = match[2];
    if (!resource) {
      detailRequests += 1;
      await gate;
      if (fail) return route.fulfill({ status: 503, json: { message: '상세 조회 지연' } });
      return route.fulfill({ json: { ...item(id), parentName: '테스트 학부모', submittedAt: '2026-11-22T09:00:00' } });
    }
    if (resource === 'messages') return route.fulfill({ json: {
      complaintId: id, allowedActions: ['WRITE_REPLY'], messages: Array.from({ length: 12 }, (_, index) => ({
        messageId: `message:${id}-${index}`, senderRole: index % 2 ? 'TEACHER' : 'PARENT', senderName: '테스트 사용자',
        content: '학교 일정에 관한 문의입니다. '.repeat(8), sentAt: `2026-11-22T09:${String(index).padStart(2, '0')}:00`, summarized: false,
      })),
    } });
    if (resource === 'risk') return route.fulfill({ json: {
      complaintId: id, riskAnalysisId: id, riskScore: 10, riskLevel: 'LOW', currentRiskScore: 10,
      currentRiskLevel: 'LOW', reviewScale: null, reviewScore: null, reviewLevel: null,
      latestReview: null, analyzedAt: '2026-11-22T09:00:00', safetyLock: false, detectedFactors: [],
    } });
    if (resource === 'history') return route.fulfill({ json: { complaintId: id, events: [], logComplete: true } });
    if (resource === 'response-draft') return route.fulfill({ json: {
      responseDraftId: id, complaintId: id, content: '기존에 저장한 답변입니다.',
      createdAt: '2026-11-22T09:00:00', updatedAt: '2026-11-22T09:00:00',
    } });
    if (resource === 'escalation') return route.fulfill({ json: {
      escalationId: null, emergencyReviewRequestId: null, escalationStatus: 'NOT_SHARED',
      riskReviewStatus: null, currentRiskScore: 10, currentRiskLevel: 'LOW', safetyLock: false,
    } });
    throw new Error(`Unexpected API resource: ${resource}`);
  });
  return {
    delay: () => { gate = new Promise<void>((resolve) => { release = resolve; }); },
    release: () => release(),
    requests: () => detailRequests,
    fail: (value: boolean) => { fail = value; },
  };
}

for (const width of [1440, 1024, 768, 375]) {
  test(`${width}px 목록 스크롤 복원과 상세 첫 위치`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== (width === 375 ? 'mobile' : 'desktop'));
    await page.setViewportSize({ width, height: 900 });
    await setupInbox(page);
    await page.goto('/teacher/messages');
    const rows = page.locator('.board-thread-button');
    await expect(rows).toHaveCount(20);
    await rows.first().click();
    await expect(page.locator('.board-detail')).toBeVisible();
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    await page.getByRole('button', { name: '목록으로 돌아가기', exact: true }).click();
    await expect(rows).toHaveCount(20);
    await rows.last().scrollIntoViewIfNeeded();
    const listY = await page.evaluate(() => scrollY);
    expect(listY).toBeGreaterThan(300);
    await rows.last().click();
    await expect(page.locator('.board-detail')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('scrolled-list-to-detail.png') });
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.goBack();
    await expect(rows).toHaveCount(20);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(listY, 0);
    await page.goForward();
    await expect(page.locator('.board-detail')).toBeVisible();
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    await page.getByRole('button', { name: '목록으로 돌아가기', exact: true }).click();
    await expect(rows).toHaveCount(20);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(listY, 0);
    // A cached, long conversation cannot rely on the browser clamping a short loading page.
    await rows.last().click();
    await expect(page.locator('.board-detail')).toBeVisible();
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  });

  test(`${width}px 느린 직접 진입과 새로고침은 상세 레이아웃을 유지한다`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== (width === 375 ? 'mobile' : 'desktop'));
    await page.setViewportSize({ width, height: 900 });
    const api = await setupInbox(page);
    await page.addInitScript(() => {
      new MutationObserver(() => {
        if (document.querySelector('.board-list-page')) document.documentElement.dataset.inboxFlashed = 'true';
      }).observe(document, { childList: true, subtree: true });
    });
    for (const refresh of [false, true]) {
      api.delay();
      const beforeRequests = api.requests();
      if (refresh) await page.reload();
      else await page.goto('/teacher/messages/319');
      await expect.poll(api.requests).toBeGreaterThan(beforeRequests);
      // Wait until the independent list has arrived: it must never become the active page.
      await expect(page.locator('.sidebar-shell')).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`slow-${refresh ? 'refresh' : 'direct'}.png`) });
      await expect(page.locator('.board-list-page')).toHaveCount(0);
      await expect(page.locator('.board-detail-page')).toBeVisible();
      const before = await page.locator('#board-detail-title').boundingBox();
      api.release();
      await expect(page.locator('.board-conversation')).toBeVisible();
      const after = await page.locator('#board-detail-title').boundingBox();
      await testInfo.attach(`layout-${width}-${refresh ? 'refresh' : 'direct'}`, {
        body: JSON.stringify({ before, after, scrollbarWidth: await page.evaluate(() => innerWidth - document.documentElement.clientWidth) }),
        contentType: 'application/json',
      });
      expect(after!.x).toBeCloseTo(before!.x, 0);
      expect(after!.y).toBeCloseTo(before!.y, 0);
      await expect(page.locator('html')).not.toHaveAttribute('data-inbox-flashed', 'true');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`loaded-${refresh ? 'refresh' : 'direct'}.png`) });
    }
  });
}

test('직접 진입 조회 실패는 상세 안에서 재시도하고 목록으로 돌아갈 수 있다', async ({ page }) => {
  const api = await setupInbox(page);
  api.fail(true);
  await page.goto('/teacher/messages/319');
  await expect(page.locator('.board-detail-page [role="alert"]')).toBeVisible();
  await expect(page.locator('.board-list-page')).toHaveCount(0);
  api.fail(false);
  await page.locator('.board-detail-page').getByRole('button', { name: /다시/ }).click();
  await expect(page.locator('.board-conversation')).toBeVisible();
  await page.getByRole('button', { name: '목록으로 돌아가기', exact: true }).click();
  await expect(page.locator('.board-thread-button')).toHaveCount(20);
});

test('느린 상세를 떠난 뒤 응답이 도착해도 목록을 덮지 않고 잘못된 주소는 로딩에 갇히지 않는다', async ({ page }) => {
  const api = await setupInbox(page);
  api.delay();
  await page.goto('/teacher/messages/319');
  await expect.poll(api.requests).toBeGreaterThan(0);
  await page.getByRole('button', { name: '목록으로 돌아가기', exact: true }).click();
  api.release();
  await expect(page.locator('.board-thread-button')).toHaveCount(20);
  await expect(page.locator('.board-detail-page')).toHaveCount(0);
  await page.goto('/teacher/messages/not-a-message');
  await expect(page.getByRole('heading', { name: '메시지를 찾을 수 없습니다', exact: true })).toBeVisible();
  await expect(page.locator('.board-list-page')).toHaveCount(0);
});

test('검색·필터·별표 탭과 사이드바 상태를 보존한다', async ({ page }, testInfo) => {
  await setupInbox(page);
  await page.goto('/teacher/messages');
  await page.getByRole('searchbox', { name: '메시지 검색' }).fill('안정성');
  await page.getByRole('button', { name: '상담 상태 필터', exact: true }).click();
  await page.getByRole('option', { name: '전체 상담', exact: true }).click();
  await expect(page.locator('.board-thread-button')).toHaveCount(20);
  await page.locator('.board-thread-star-button').first().click();
  await page.getByRole('tab', { name: /별표 메시지/ }).click();
  await expect(page.locator('.board-thread-button')).toHaveCount(1);
  if (testInfo.project.name === 'desktop') {
    await page.getByRole('button', { name: '사이드바 접기', exact: true }).click();
    await expect(page.locator('.board-inbox-page')).toHaveClass(/is-sidebar-collapsed/);
  }
  await page.locator('.board-thread-button').click();
  await expect(page.locator('.board-conversation')).toBeVisible();
  if (testInfo.project.name === 'desktop') {
    await expect(page.getByRole('button', { name: '사이드바 펼치기', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '사이드바 펼치기', exact: true }).click();
    await expect(page.locator('.board-inbox-page')).not.toHaveClass(/is-sidebar-collapsed/);
  }
  await page.getByRole('button', { name: '목록으로 돌아가기', exact: true }).click();
  await expect(page.getByRole('tab', { name: /별표 메시지/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('searchbox', { name: '메시지 검색' })).toHaveValue('안정성');
  await expect(page.getByRole('button', { name: '상담 상태 필터', exact: true })).toContainText('전체 상담');
  await expect(page.locator('.board-thread-button')).toHaveCount(1);
});

test('작성 중 답변과 포커스를 유지하고 메시지 화면 밖의 스크롤 정책을 복구한다', async ({ page }, testInfo) => {
  await setupInbox(page);
  await page.goto('/teacher/messages/319');
  await expect(page.locator('.board-reply')).toHaveCount(12);
  await page.getByRole('button', { name: '답변 작성', exact: true }).click();
  const editor = page.getByLabel('선생님 답변', { exact: true });
  await expect(editor).toHaveValue('기존에 저장한 답변입니다.');
  await editor.fill('이동해도 유지할 작성 중 답변');
  await page.getByRole('button', { name: '답변 작성 닫기', exact: true }).click();
  await page.goBack();
  await page.getByRole('tab', { name: '직접 작성', exact: true }).click();
  await expect(editor).toHaveValue('이동해도 유지할 작성 중 답변');
  await page.goForward();
  await expect(editor).toHaveCount(0);
  await page.getByRole('button', { name: /답변 이어서 작성하기/ }).click();
  await page.getByRole('tab', { name: '직접 작성', exact: true }).click();
  await expect(editor).toHaveValue('이동해도 유지할 작성 중 답변');
  // Text-only zoom: preserve access to the close action and editor at 200%.
  await page.addStyleTag({ content: '.board-detail { font-size: 200%; } .board-detail button, .board-detail textarea { font-size: 2rem; }' });
  await page.getByRole('button', { name: '답변 작성 닫기', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(editor).toHaveCount(0);
  if (testInfo.project.name === 'desktop') {
    await page.getByRole('link', { name: '대응 가이드', exact: true }).click();
    await expect.poll(() => page.evaluate(() => history.scrollRestoration)).toBe('auto');
  }
});
