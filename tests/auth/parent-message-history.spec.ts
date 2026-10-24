import { expect, test, type Page } from '@playwright/test';

const sentKey = 'teacher-hub.parent-sent-messages.101';
const draftKey = 'teacher-hub.parent-message-draft.101';

function inquiry(id: string, status: 'before' | 'inProgress' | 'complete', title: string) {
  const at = '2026-08-10T10:00:00+09:00';
  return {
    messageId: id, teacherId: 'teacher-102', teacherName: '김OO 선생님', title,
    originalBody: `${title}에 대해 문의드립니다.`, finalBody: `${title}에 대해 문의드립니다.`,
    selectionType: 'ORIGINAL', selectionSource: 'ORIGINAL', status: 'SENT', sentAt: at,
    consultationStatus: status, auditLog: [{ action: 'SENT', at, selectionType: 'ORIGINAL' }],
  };
}

async function login(page: Page, role = 'PARENT') {
  if (page.url() !== 'about:blank') await page.evaluate(() => localStorage.removeItem('teacher-hub.auth-session'));
  await page.goto(`/login?role=${role}`);
  await page.locator('input[name="email"]').fill(role === 'PARENT' ? 'parent@example.com' : 'teacher@example.com');
  await page.locator('input[name="password"]').fill('password123');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page).toHaveURL(role === 'PARENT' ? /\/parent\/messages\/new$/ : /\/teacher(?:\/messages)?$/);
}

async function seed(page: Page) {
  await page.evaluate(({ key, messages, other }) => {
    localStorage.setItem(key, JSON.stringify(messages));
    localStorage.setItem('teacher-hub.parent-sent-messages.999', JSON.stringify([other]));
    localStorage.setItem('teacher-hub.parent-message-mock-settings', JSON.stringify({ analysisDelayMs: 20, sendDelayMs: 20 }));
  }, { key: sentKey, messages: [inquiry('before', 'before', '현장체험학습 준비물'), inquiry('active', 'inProgress', '상담 일정 요청'), inquiry('done', 'complete', '방과후 출결 확인')], other: inquiry('private', 'before', '다른 학부모 비공개 문의') });
}

async function send(page: Page) {
  await page.getByRole('button', { name: 'AI 분석 시작', exact: true }).click();
  await expect(page).toHaveURL(/\/review$/);
  const reviewUrl = page.url();
  await page.getByRole('button', { name: '전송하기', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '문의를 전송할까요?', exact: true });
  await dialog.getByRole('button', { name: '확인 후 전송', exact: true }).evaluate((element) => {
    (element as HTMLButtonElement).click();
    (element as HTMLButtonElement).click();
  });
  await expect(page.getByRole('heading', { name: '문의가 전송되었습니다.', exact: true })).toBeVisible();
  return reviewUrl;
}

test('본인 문의만 표시하고 상담 상태, 검색, 중요 문의를 유지한다', async ({ page }, testInfo) => {
  await login(page);
  await seed(page);
  await page.goto('/parent/messages');
  await expect(page.locator('.parent-history-link')).toHaveCount(3);
  for (const status of ['상담 전', '상담 중', '상담 완료']) await expect(page.getByText(status, { exact: true })).toBeVisible();
  await expect(page.getByText('다른 학부모 비공개 문의', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '현장체험학습 준비물 중요 문의 등록', exact: true }).click();
  await page.getByRole('tab', { name: '중요 문의', exact: true }).click();
  await expect(page.locator('.parent-history-link')).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole('button', { name: '현장체험학습 준비물 중요 문의 해제', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '현장체험학습 준비물 중요 문의 해제', exact: true }).click();
  await expect(page.getByRole('heading', { name: '중요 문의가 없습니다.', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '전체 문의', exact: true }).click();
  await page.getByRole('searchbox', { name: '문의 검색', exact: true }).fill('김OO');
  await expect(page.locator('.parent-history-link')).toHaveCount(3);
  await page.getByRole('searchbox', { name: '문의 검색', exact: true }).fill('준비물');
  await expect(page.locator('.parent-history-link')).toHaveCount(1);
  await page.getByRole('searchbox', { name: '문의 검색', exact: true }).fill('없는 검색어');
  await expect(page.getByRole('heading', { name: '검색 결과가 없습니다.', exact: true })).toBeVisible();
  await page.getByRole('searchbox', { name: '문의 검색', exact: true }).fill('');
  const viewport = page.viewportSize()!;
  for (const width of [320, 620, viewport.width]) {
    await page.setViewportSize({ width, height: viewport.height });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.screenshot({ path: testInfo.outputPath('parent-history.png'), fullPage: true });
  await page.goto('/parent/messages/private');
  await expect(page.getByRole('heading', { name: '문의를 찾을 수 없습니다.', exact: true })).toBeVisible();
  await page.goto('/parent/messages/private/follow-up');
  await expect(page.getByRole('heading', { name: '작성할 문의를 찾을 수 없습니다.', exact: true })).toBeVisible();
  await page.evaluate(() => localStorage.setItem('teacher-hub.parent-message-draft.999', JSON.stringify({
    messageId: 'private-draft', teacherId: 'teacher-102', title: '다른 학부모 초안', body: '비공개 초안', status: 'DRAFT',
  })));
  await page.goto('/parent/messages?tab=drafts');
  await expect(page.locator('.parent-draft-row')).toHaveCount(0);
  await page.goto('/parent/messages/new?draft=private-draft');
  await expect(page.getByRole('heading', { name: '작성할 문의를 찾을 수 없습니다.', exact: true })).toBeVisible();
});

test('완료된 문의에 추가 질문을 연결하고 교사가 재확인 및 완료 처리한다', async ({ page }, testInfo) => {
  await login(page);
  await seed(page);
  await page.goto('/parent/messages');
  const parentRow = page.locator('.parent-history-link').filter({ hasText: '방과후 출결 확인' });
  await expect(parentRow.getByText('상담 완료', { exact: true })).toBeVisible();
  await parentRow.click();
  await expect(page.getByRole('button', { name: '확인했어요', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '추가 문의하기', exact: true }).click();
  await expect(page.getByLabel('문의 대상', { exact: true })).toHaveValue('김OO 선생님');
  await expect(page.getByLabel('문의 제목', { exact: true })).toHaveAttribute('readonly', '');
  await page.getByRole('button', { name: 'AI 분석 시작', exact: true }).click();
  await expect(page.getByText('문의 내용을 입력해 주세요.', { exact: true })).toBeVisible();
  await page.getByLabel('문의 내용', { exact: true }).fill('방과후 출결은 생활기록부에도 반영되나요?');
  const reviewUrl = await send(page);
  await expect(page).toHaveURL(/\/parent\/messages\/done$/);
  await expect(page.getByRole('region', { name: '전송한 문의 내용', exact: true })).toHaveCount(0);
  await page.getByRole('status').getByRole('link', { name: '문의 내역', exact: true }).click();
  await expect(page).toHaveURL(/\/parent\/messages$/);
  await page.locator('.parent-history-link').filter({ hasText: '방과후 출결 확인' }).click();
  await expect(page.getByRole('region', { name: '전송한 문의 내용', exact: true })).toHaveCount(2);
  const messages = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), sentKey);
  expect(messages).toHaveLength(3);
  const thread = messages.find((entry: { messageId: string }) => entry.messageId === 'done');
  expect(thread.conversation).toHaveLength(2);
  expect(thread.auditLog).toHaveLength(2);
  expect(thread.consultationStatus).toBe('inProgress');
  expect(thread.needsTeacherReview).toBe(true);
  await page.goto(reviewUrl);
  await expect(page).toHaveURL(/\/parent\/messages\/done$/);
  await page.screenshot({ path: testInfo.outputPath('parent-conversation.png'), fullPage: true });

  await login(page, 'TEACHER');
  await page.goto('/teacher/messages');
  await expect(page.getByRole('status')).toContainText('추가 질문이 도착했습니다.');
  const row = page.locator('.board-thread-row').filter({ hasText: '방과후 출결 확인' });
  await expect(row.getByText('재확인 필요', { exact: true })).toBeVisible();
  await expect(row.getByText('주의 필요', { exact: true })).toHaveCount(0);
  await row.getByRole('button', { name: /메시지 상세 보기/ }).click();
  await page.getByRole('button', { name: '확인했어요', exact: true }).click();
  await expect(page.getByText('재확인 필요', { exact: true })).toHaveCount(0);
  await expect(page.locator('.board-consultation-controls').getByText('상담 중', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '답변 작성하러 가기', exact: true }).click();
  await page.getByLabel('선생님 답변', { exact: true }).fill('학교 출결 규정에 따라 안내드리겠습니다.');
  await page.getByRole('button', { name: '검토 후 전송', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: '답변 전 확인', exact: true });
  await confirm.getByRole('checkbox').check();
  await confirm.getByRole('button', { name: '최종 전송', exact: true }).click();
  await page.getByRole('dialog', { name: '답변 전송 완료', exact: true }).getByRole('button', { name: '확인', exact: true }).click();
  await expect(page.locator('.board-consultation-controls').getByText('상담 중', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '상담 완료 처리', exact: true }).click();
  await page.reload();
  await expect(page.locator('.board-consultation-controls').getByText('상담 완료', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인 완료', exact: true })).toBeDisabled();
  await expect(page.locator('.board-consultation-controls').getByText('상담 완료', { exact: true })).toBeVisible();
  await login(page);
  await page.goto('/parent/messages');
  await expect(parentRow.getByText('상담 완료', { exact: true })).toBeVisible();
  await parentRow.click();
  await expect(page.getByRole('region', { name: '전체 대화 내역', exact: true })).toContainText('학교 출결 규정에 따라 안내드리겠습니다.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('교사의 확인은 상담 상태를 유지하고 상담 시작과 완료만 상태를 바꾼다', async ({ page }) => {
  await login(page, 'TEACHER');
  await seed(page);
  for (const [id, status] of [['before', '상담 전'], ['active', '상담 중'], ['done', '상담 완료']]) {
    await page.goto(`/teacher/messages/${id}`);
    await page.getByRole('button', { name: '확인했어요', exact: true }).click();
    await expect(page.locator('.board-consultation-controls').getByText(status, { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: '확인 완료', exact: true })).toBeDisabled();
    await expect(page.locator('.board-consultation-controls').getByText(status, { exact: true })).toBeVisible();
  }
  await page.goto('/teacher/messages/before');
  await page.getByRole('button', { name: '상담 시작', exact: true }).click();
  await expect(page.locator('.board-consultation-controls').getByText('상담 중', { exact: true })).toBeVisible();
});

test('새 주제는 별도 문의를 만들고 기존 문의의 완료 상태를 유지한다', async ({ page }) => {
  await login(page);
  await seed(page);
  await page.goto('/parent/messages/done');
  await page.getByRole('link', { name: '새 문의 작성', exact: true }).click();
  await expect(page.getByLabel('문의 제목', { exact: true })).toHaveValue('');
  await page.getByLabel('문의 제목', { exact: true }).fill('새로운 급식 문의');
  await page.getByLabel('문의 내용', { exact: true }).fill('다음 달 급식표는 어디에서 확인할 수 있나요?');
  await send(page);
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), sentKey);
  expect(stored).toHaveLength(4);
  expect(stored.find((entry: { messageId: string }) => entry.messageId === 'done').consultationStatus).toBe('complete');
  expect(stored.find((entry: { title: string }) => entry.title === '새로운 급식 문의').consultationStatus).toBe('before');
});

test('여러 임시저장을 구분하고 모달을 닫거나 이어서 작성해도 내용을 유지한다', async ({ page }) => {
  await login(page);
  await seed(page);
  await page.getByLabel('문의 제목', { exact: true }).fill('첫 번째 작성 중');
  await page.getByLabel('문의 내용', { exact: true }).fill('첫 번째 임시저장 내용');
  await page.getByRole('button', { name: '임시저장', exact: true }).click();
  await page.goto('/parent/messages/new?fresh=1');
  await page.getByLabel('문의 제목', { exact: true }).fill('두 번째 작성 중');
  await page.getByLabel('문의 내용', { exact: true }).fill('두 번째 임시저장 내용');
  await page.getByRole('button', { name: '임시저장', exact: true }).click();
  await page.reload();
  await expect(page.getByLabel('문의 내용', { exact: true })).toHaveValue('두 번째 임시저장 내용');
  await page.goto('/parent/messages/done/follow-up');
  await page.getByLabel('문의 내용', { exact: true }).fill('완료 건의 추가 문의 초안');
  await page.getByRole('button', { name: '임시저장', exact: true }).click();
  await page.goto('/parent/messages?tab=drafts');
  await expect(page.locator('.parent-draft-row')).toHaveCount(3);
  await page.getByRole('button', { name: /첫 번째 작성 중/ }).click();
  let dialog = page.getByRole('dialog', { name: '작성 중인 문의가 있어요.', exact: true });
  await dialog.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(page).toHaveURL(/tab=drafts$/);
  await expect(page.locator('.parent-draft-row')).toHaveCount(3);
  await page.getByRole('button', { name: /첫 번째 작성 중/ }).click();
  dialog = page.getByRole('dialog', { name: '작성 중인 문의가 있어요.', exact: true });
  await dialog.getByRole('button', { name: '이어서 작성', exact: true }).click();
  await expect(page.getByLabel('문의 내용', { exact: true })).toHaveValue('첫 번째 임시저장 내용');
  await page.goto('/parent/messages?tab=drafts');
  await page.getByRole('button', { name: /방과후 출결 확인/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: '이어서 작성', exact: true }).click();
  await expect(page.getByRole('heading', { name: '추가 문의하기', exact: true })).toBeVisible();
  await expect(page.getByLabel('문의 내용', { exact: true })).toHaveValue('완료 건의 추가 문의 초안');
  await send(page);
  const remaining = await page.evaluate((key) => JSON.parse(localStorage.getItem(`${key}.all`)!), draftKey);
  expect(remaining).toHaveLength(2);
});

test('손상된 임시저장 목록은 백업하고 읽을 수 없는 항목은 저장 후에도 유지한다', async ({ page }) => {
  await login(page);
  await seed(page);
  await page.evaluate((key) => localStorage.setItem(`${key}.all`, '{broken'), draftKey);
  await page.goto('/parent/messages?tab=drafts');
  await expect(page.getByText('임시저장한 문의가 없습니다.', { exact: true })).toBeVisible();
  await page.goto('/parent/messages/new?fresh=1');
  await page.getByLabel('문의 제목', { exact: true }).fill('복구 후 작성');
  await page.getByLabel('문의 내용', { exact: true }).fill('손상 이후 임시저장 내용');
  await page.getByRole('button', { name: '임시저장', exact: true }).click();
  await expect(page.getByText('문의가 임시저장되었습니다.', { exact: true })).toBeVisible();
  const backups = await page.evaluate((key) => Object.keys(localStorage)
    .filter((item) => item.startsWith(`${key}.all.corrupted.`)).map((item) => localStorage.getItem(item)), draftKey);
  expect(backups).toEqual(['{broken']);

  const unreadable = { messageId: 'unreadable', title: 42 };
  await page.evaluate(({ key, entry }) => {
    const entries = JSON.parse(localStorage.getItem(`${key}.all`)!);
    localStorage.setItem(`${key}.all`, JSON.stringify([...entries, entry]));
  }, { key: draftKey, entry: unreadable });
  await page.getByLabel('문의 내용', { exact: true }).fill('다시 저장한 내용');
  await page.getByRole('button', { name: '임시저장', exact: true }).click();
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(`${key}.all`)!), draftKey);
  expect(stored).toHaveLength(2);
  expect(stored).toContainEqual(unreadable);
  await page.goto('/parent/messages?tab=drafts');
  await expect(page.locator('.parent-draft-row')).toHaveCount(1);
});

test('저장소 접근이 막혀도 교사 문의 화면을 표시한다', async ({ page }) => {
  await login(page, 'TEACHER');
  await page.evaluate(() => {
    Object.defineProperty(Storage.prototype, 'key', { configurable: true, value: () => { throw new DOMException('blocked', 'SecurityError'); } });
  });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.locator('.board-thread-copy').first()).toBeVisible();
});
