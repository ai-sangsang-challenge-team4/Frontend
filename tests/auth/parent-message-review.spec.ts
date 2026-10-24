import { expect, test, type Page } from '@playwright/test';

const original = [
  '선생님, 지난주에도 상담 요청드렸는데 아직 아무 연락이 없으시네요.',
  '아이가 학교생활 때문에 계속 힘들어하고 있는데 언제까지 기다려야 하는 건가요?',
  '이번 주 안으로 꼭 상담 일정을 잡아주시고 지금까지 왜 아무 조치가 없었는지도 설명해 주세요.',
  '계속 이런 식으로 대응하시면 교육청에 민원을 넣는 것도 생각하고 있습니다.',
].join('\n');
const draftKey = 'teacher-hub.parent-message-draft.101';
const sentKey = 'teacher-hub.parent-sent-messages.101';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('teacher-hub.parent-message-mock-settings', JSON.stringify({ analysisDelayMs: 60, sendDelayMs: 100 }));
  });
});

async function openReview(page: Page, failAnalysis = false) {
  await page.goto('/login?role=PARENT');
  await page.locator('input[name="email"]').fill('parent@example.com');
  await page.locator('input[name="password"]').fill('password123');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page).toHaveURL(/\/parent\/messages\/new$/);
  await page.getByLabel('문의 제목', { exact: true }).fill('아이의 학교생활 상담 요청');
  await page.getByLabel('문의 내용', { exact: true }).fill(original);
  if (failAnalysis) await page.evaluate(() => {
    localStorage.setItem('teacher-hub.parent-message-mock-settings', JSON.stringify({ failAnalysis: true, analysisDelayMs: 60, sendDelayMs: 100 }));
  });
  await page.getByRole('button', { name: 'AI 분석 시작', exact: true }).click();
  await expect(page).toHaveURL(/\/parent\/messages\/[^/]+\/review$/);
  await expect(page.getByRole('tab', { name: failAnalysis ? '원문' : 'AI 초안', exact: true })).toHaveAttribute('aria-selected', 'true');
}

async function confirmSend(page: Page) {
  await page.getByRole('button', { name: '전송하기', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '문의를 전송할까요?', exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

test('원문에서 주의 표현과 설명을 표시하고 탭과 접기 동작을 제공한다', async ({ page }, testInfo) => {
  if (page.viewportSize()!.width > 980) await page.setViewportSize({ width: 1440, height: 1095 });
  await openReview(page);
  await expect(page.getByLabel('AI 초안 내용', { exact: true })).not.toHaveValue(original);
  await expect(page.getByRole('note')).toContainText('공식 절차에 관한 의사가 완화');
  await page.screenshot({ path: testInfo.outputPath('parent-review-ai.png'), fullPage: true });

  await page.getByRole('tab', { name: '원문', exact: true }).click();
  await expect(page.locator('.parent-review-original')).toHaveText(original);
  await expect(page.locator('.parent-review-original mark')).toHaveCount(3);
  await expect(page.getByRole('heading', { name: '탐지된 위험 표현 목록 (3)', exact: true })).toBeVisible();
  await page.locator('.parent-review-original mark').nth(1).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#demanding-schedule-accordion-panel')).toContainText('상대에게 부담이 될 수 있습니다.');
  await expect(page.locator('#demanding-schedule-accordion-trigger')).toHaveAttribute('aria-expanded', 'true');
  await page.screenshot({ path: testInfo.outputPath('parent-review-original.png'), fullPage: true });

  await page.getByRole('button', { name: '주의 표현 목록 접기', exact: true }).click();
  await expect(page.locator('#parent-review-risks-list')).toBeHidden();
  await page.getByRole('button', { name: '주의 표현 목록 펼치기', exact: true }).click();
  await expect(page.locator('#parent-review-risks-list')).toBeVisible();
  await page.getByRole('tab', { name: '원문', exact: true }).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('tab', { name: 'AI 초안', exact: true })).toHaveAttribute('aria-selected', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('AI 수정본을 복원하고 개인정보를 재검사한 최종 문장을 한 번만 전송한다', async ({ page }, testInfo) => {
  await openReview(page);
  const edited = '선생님, 이번 주 상담이 가능한지 문의드립니다. 연락처는 010-1234-5678이고 이메일은 parent@test.com입니다.';
  await page.getByLabel('AI 초안 내용', { exact: true }).fill(edited);
  await page.getByRole('tab', { name: '원문', exact: true }).click();
  await expect(page.locator('.parent-review-original')).toHaveText(original);
  await page.getByRole('tab', { name: 'AI 초안', exact: true }).click();
  await expect(page.getByLabel('AI 초안 내용', { exact: true })).toHaveValue(edited);
  await page.getByRole('button', { name: '임시저장', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('선택한 문의가 임시저장되었습니다.');
  await page.reload();
  await expect(page.getByLabel('AI 초안 내용', { exact: true })).toHaveValue(edited);
  await page.getByRole('button', { name: '문의 작성으로 돌아가기', exact: true }).click();
  await expect(page).toHaveURL(/\/parent\/messages\/new$/);
  await page.getByRole('button', { name: 'AI 분석 시작', exact: true }).click();
  await expect(page.getByLabel('AI 초안 내용', { exact: true })).toHaveValue(edited);

  await page.getByRole('button', { name: '미리보기', exact: true }).click();
  const preview = page.getByRole('dialog', { name: '문의 미리보기', exact: true });
  await expect(preview.locator('.parent-review-preview-body')).toContainText('[전화번호]');
  await expect(preview.locator('.parent-review-preview-body')).toContainText('[이메일]');
  await expect(preview).not.toContainText('010-1234-5678');
  await expect(preview.getByText('직접 수정', { exact: true })).toBeVisible();
  await preview.getByRole('button', { name: '닫기', exact: true }).first().click();

  const reviewUrl = page.url();
  const dialog = await confirmSend(page);
  await page.screenshot({ path: testInfo.outputPath('parent-review-confirm.png'), fullPage: true });
  await dialog.getByRole('button', { name: '확인 후 전송', exact: true }).evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  await expect(page.getByRole('heading', { name: '전송 완료', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '문의가 전송되었습니다.', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('parent-message-sent.png'), fullPage: true });

  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), sentKey);
  expect(stored).toHaveLength(1);
  expect(stored[0]).toMatchObject({ status: 'SENT', selectionType: 'CUSTOM', selectionSource: 'AI', originalBody: original });
  expect(stored[0].auditLog).toHaveLength(1);
  expect(stored[0].finalBody).toContain('[전화번호]');
  expect(await page.evaluate((key) => localStorage.getItem(key), draftKey)).toBeNull();

  await page.goto(reviewUrl);
  await expect(page).not.toHaveURL(/\/review$/);
  await expect(page.getByRole('region', { name: '전송한 문의 내용', exact: true })).toContainText('[이메일]');
  await page.getByRole('button', { name: '문의 내역', exact: true }).click();
  await expect(page.locator('.parent-history-link')).toHaveCount(1);
  await page.locator('.parent-history-link').click();
  await expect(page.getByRole('heading', { name: '문의 상세', exact: true })).toBeVisible();
});

for (const source of ['AI', 'ORIGINAL'] as const) {
  test(`${source === 'AI' ? 'AI 초안' : '원문'}을 선택하면 선택 유형과 해당 문장을 저장한다`, async ({ page }) => {
    await openReview(page);
    if (source === 'ORIGINAL') await page.getByRole('tab', { name: '원문', exact: true }).click();
    const expectedBody = source === 'ORIGINAL' ? original : await page.getByLabel('AI 초안 내용', { exact: true }).inputValue();
    const dialog = await confirmSend(page);
    await dialog.getByRole('button', { name: '취소', exact: true }).click();
    expect(await page.evaluate((key) => localStorage.getItem(key), sentKey)).toBeNull();
    const reopened = await confirmSend(page);
    await reopened.getByRole('button', { name: '확인 후 전송', exact: true }).click();
    await expect(page.getByRole('heading', { name: '전송 완료', exact: true })).toBeVisible();
    const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), sentKey);
    expect(stored[0]).toMatchObject({ selectionType: source, selectionSource: source, finalBody: expectedBody });
  });
}

test('직접 수정한 원문을 유지하고 빈 입력과 1500자 초과 입력을 차단한다', async ({ page }) => {
  await openReview(page);
  await page.getByLabel('AI 초안 내용', { exact: true }).fill(' \n ');
  await page.getByRole('button', { name: '전송하기', exact: true }).click();
  await expect(page.getByText('전송할 문의 내용을 입력해 주세요.', { exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'AI 초안 복원', exact: true }).click();

  await page.evaluate((key) => {
    const draft = JSON.parse(localStorage.getItem(key)!);
    draft.review.aiText = '가'.repeat(1501);
    localStorage.setItem(key, JSON.stringify(draft));
  }, draftKey);
  await page.reload();
  await page.getByRole('button', { name: '미리보기', exact: true }).click();
  await expect(page.getByText('문의 내용은 1500자 이내로 작성해 주세요.', { exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('tab', { name: '원문', exact: true }).click();
  await page.getByRole('button', { name: '직접 수정', exact: true }).click();
  await page.getByLabel('직접 수정한 문의 내용', { exact: true }).fill('상담 요청 이후 진행된 사항을 알려 주시면 감사하겠습니다.');
  await page.getByRole('button', { name: '임시저장', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('tab', { name: '원문', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByLabel('직접 수정한 문의 내용', { exact: true })).toHaveValue('상담 요청 이후 진행된 사항을 알려 주시면 감사하겠습니다.');
  const dialog = await confirmSend(page);
  await dialog.getByRole('button', { name: '확인 후 전송', exact: true }).click();
  await expect(page.getByRole('heading', { name: '전송 완료', exact: true })).toBeVisible();
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), sentKey);
  expect(stored[0]).toMatchObject({ selectionType: 'CUSTOM', selectionSource: 'ORIGINAL', originalBody: original });
});

test('AI 분석 실패 시 원문 선택과 전송 경로를 유지한다', async ({ page }) => {
  await openReview(page, true);
  await expect(page.getByRole('tab', { name: 'AI 초안', exact: true })).toBeDisabled();
  await expect(page.getByRole('status')).toContainText('AI 수정안을 불러오지 못했습니다.');
  await expect(page.locator('.parent-review-original')).toHaveText(original);
  const dialog = await confirmSend(page);
  await dialog.getByRole('button', { name: '확인 후 전송', exact: true }).click();
  await expect(page.getByRole('heading', { name: '전송 완료', exact: true })).toBeVisible();
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), sentKey);
  expect(stored[0]).toMatchObject({ selectionType: 'ORIGINAL', finalBody: original });
});

test('전송 실패 후 동일한 최종 문장으로 재시도하고 중복 저장하지 않는다', async ({ page }) => {
  await openReview(page);
  await page.getByRole('tab', { name: '원문', exact: true }).click();
  await page.evaluate(() => {
    localStorage.setItem('teacher-hub.parent-message-mock-settings', JSON.stringify({ failSend: true, sendDelayMs: 60 }));
  });
  const dialog = await confirmSend(page);
  await dialog.getByRole('button', { name: '확인 후 전송', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('문의를 전송하지 못했습니다.');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.parent-review-preview-body')).toHaveText(original);
  expect(await page.evaluate((key) => localStorage.getItem(key), sentKey)).toBeNull();

  await page.getByRole('button', { name: '알림 닫기', exact: true }).click();
  await page.evaluate(() => {
    localStorage.setItem('teacher-hub.parent-message-mock-settings', JSON.stringify({ sendDelayMs: 60 }));
  });
  await dialog.getByRole('button', { name: '확인 후 전송', exact: true }).click();
  await expect(page.getByRole('heading', { name: '전송 완료', exact: true })).toBeVisible();
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), sentKey);
  expect(stored).toHaveLength(1);
  expect(stored[0].finalBody).toBe(original);
});

test('다른 문의 ID와 다른 계정의 문의를 노출하지 않는다', async ({ page }) => {
  await openReview(page);
  const before = await page.evaluate((key) => localStorage.getItem(key), draftKey);
  await page.goto('/parent/messages/not-my-message/review');
  await expect(page.getByRole('heading', { name: '검토할 문의를 찾을 수 없습니다.', exact: true })).toBeVisible();
  await expect(page.locator('.parent-review-original')).toHaveCount(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), draftKey)).toBe(before);
  await page.goto('/parent/messages/not-my-message');
  await expect(page.getByRole('heading', { name: '문의를 찾을 수 없습니다.', exact: true })).toBeVisible();
  await page.evaluate(() => {
    const at = new Date().toISOString();
    localStorage.setItem('teacher-hub.parent-sent-messages.999', JSON.stringify([{
      messageId: 'other-parent-message', teacherId: 'teacher-102', teacherName: '김OO 선생님',
      title: '다른 학부모의 문의', originalBody: '다른 계정의 비공개 내용', finalBody: '다른 계정의 비공개 내용',
      selectionType: 'ORIGINAL', selectionSource: 'ORIGINAL', status: 'SENT', sentAt: at,
      auditLog: [{ action: 'SENT', at, selectionType: 'ORIGINAL' }],
    }]));
  });
  await page.goto('/parent/messages/other-parent-message');
  await expect(page.getByRole('heading', { name: '문의를 찾을 수 없습니다.', exact: true })).toBeVisible();
  await expect(page.getByText('다른 계정의 비공개 내용', { exact: true })).toHaveCount(0);
  await page.goto('/parent/messages');
  await expect(page.getByRole('heading', { name: '전송한 문의가 없습니다.', exact: true })).toBeVisible();
});
