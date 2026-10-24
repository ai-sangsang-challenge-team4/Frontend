import { expect, test, type Page } from '@playwright/test';

async function loginTeacher(page: Page) {
  await page.goto('/login?role=TEACHER');
  await page.locator('input[name="email"]').fill('teacher@example.com');
  await page.locator('input[name="password"]').fill('password123');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page).toHaveURL(/\/teacher(?:\/messages)?$/);
}

async function choose(page: Page, dropdown: string, option: string) {
  await page.getByRole('button', { name: dropdown, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

async function openRiskTab(page: Page, threadId: string) {
  await page.goto(`/teacher/messages/${threadId}`);
  await page.getByRole('navigation', { name: '메시지 상세 탭' }).getByRole('button', { name: '위험 요소', exact: true }).click();
}

const rowTitles = (page: Page) => page.locator('.board-thread-title-row strong');

test.beforeEach(async ({ page }) => {
  await loginTeacher(page);
});

test('완료된 상담은 기본으로 숨기고 상담 상태로 다시 볼 수 있다', async ({ page }) => {
  await page.goto('/teacher/messages');
  await expect(rowTitles(page)).toHaveCount(4);
  await expect(page.getByText('방과후 수업 결석 처리 확인', { exact: true })).toHaveCount(0);

  await choose(page, '상담 상태 필터', '완료된 상담');
  await expect(rowTitles(page)).toHaveText(['방과후 수업 결석 처리 확인']);

  await choose(page, '상담 상태 필터', '전체 상담');
  await expect(rowTitles(page)).toHaveCount(5);
});

test('필터상세에서 위험도로 거르고 위험도 순으로 정렬한 뒤 초기화한다', async ({ page }) => {
  await page.goto('/teacher/messages');
  const toggle = page.getByRole('button', { name: /^필터상세/ });
  await expect(page.getByRole('group', { name: '상세 필터', exact: true })).toHaveCount(0);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');

  await choose(page, '위험도 필터', '긴급');
  await expect(rowTitles(page)).toHaveText(['상담 일정 및 조치 내용 확인 요청']);
  await expect(toggle).toContainText('1');

  await choose(page, '위험도 필터', '전체');
  await choose(page, '정렬 기준', '위험도 높은 순');
  await expect(rowTitles(page)).toHaveText([
    '상담 일정 및 조치 내용 확인 요청',
    '가정 내 변화에 따른 학교 생활 확인',
    '친구와의 갈등 후속 확인',
    '현장체험학습 준비물 문의',
  ]);

  await page.getByRole('button', { name: '초기화', exact: true }).click();
  await expect(page.getByRole('button', { name: '정렬 기준', exact: true })).toContainText('최신순');
  await expect(page.getByRole('button', { name: '초기화', exact: true })).toBeDisabled();
});

test('교사가 1~7점으로 위험도를 평가하고 하향 시에는 사유를 요구한다', async ({ page }) => {
  await openRiskTab(page, 'thread-002');
  const guide = page.locator('.board-risk-score-guide');
  await expect(page.getByRole('button', { name: '3점 약간 주의', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(guide).toContainText('3점 · 약간 주의');

  await page.getByRole('button', { name: '6점 높은 위험', exact: true }).click();
  await expect(guide).toContainText('6점 · 높은 위험');
  await expect(guide).toContainText('위험 단계');
  await page.getByRole('button', { name: '상향 반영', exact: true }).click();
  // The saved 6 becomes the new reference, so moving to 2 is now a downgrade.
  await expect(page.getByRole('button', { name: '검토 완료', exact: true })).toBeVisible();

  await page.getByRole('button', { name: '2점 안전', exact: true }).click();
  const submit = page.getByRole('button', { name: '하향 반영', exact: true });
  await expect(submit).toBeDisabled();
  await page.getByPlaceholder('하향 수정 사유를 입력해주세요.').fill('단순 일정 확인 문의입니다.');
  await expect(submit).toBeEnabled();

  await page.getByRole('navigation', { name: '메시지 상세 탭' }).getByRole('button', { name: '처리 기록', exact: true }).click();
  await expect(page.getByText(/수정 전 위험도: 주의\(3점\), 수정 후 위험도: 위험\(6점\)/)).toBeVisible();
});

test('AI 판단 이의 제기는 유형과 사유를 남기고 처리 기록에 저장한다', async ({ page }) => {
  await openRiskTab(page, 'thread-002');
  await page.getByRole('button', { name: 'AI 판단이 틀렸어요', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'AI 판단이 틀렸나요?', exact: true });
  const submit = dialog.getByRole('button', { name: '이의 제기', exact: true });
  await expect(submit).toBeDisabled();
  await dialog.getByLabel('실제보다 위험하게 판단했어요', { exact: true }).check();
  await expect(submit).toBeDisabled();
  await dialog.getByLabel('사유', { exact: true }).fill('친구 관계 확인 요청일 뿐 공격적인 표현이 없습니다.');
  await submit.click();

  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: '이의 제기 완료', exact: true })).toBeDisabled();
  await page.getByRole('navigation', { name: '메시지 상세 탭' }).getByRole('button', { name: '처리 기록', exact: true }).click();
  await expect(page.getByText('AI 판단 이의 제기', { exact: true })).toBeVisible();
  await expect(page.getByText(/유형: 실제보다 위험하게 판단했어요, 사유: "친구 관계 확인 요청일 뿐/)).toBeVisible();
});

test('사이드바 메시지 개수는 진행 중 상담 수를 따라간다', async ({ page }, testInfo) => {
  const badge = page.locator(testInfo.project.name === 'mobile' ? '.sidebar-mobile-badge' : '.sidebar-badge');
  await page.goto('/teacher/messages');
  if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: /메뉴/ }).first().click();
  await expect(badge).toHaveText('4');

  await page.goto('/teacher/messages/thread-002');
  await page.locator('.board-answer-actions').getByRole('button', { name: '상담 완료 처리', exact: true }).click();
  if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: /메뉴/ }).first().click();
  await expect(badge).toHaveText('3');

  // Mock inbox threads live in memory only, so another page starts again from the initial four.
  await page.goto('/teacher/guide');
  if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: /메뉴/ }).first().click();
  await expect(badge).toHaveText('4');
});

test('답변 작성 화면의 원문 보기는 원문 열람 화면을 열고 답변 작성으로 돌아온다', async ({ page }) => {
  await page.goto('/teacher/messages/thread-002/response');
  await page.getByRole('button', { name: '원문 보기', exact: true }).click();
  await page.getByRole('button', { name: '원문 확인', exact: true }).click();

  await expect(page).toHaveURL(/\/teacher\/messages\/thread-002$/);
  await expect(page.getByText('원문 열람', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: '답변 작성하기', exact: true }).click();
  await expect(page).toHaveURL(/\/teacher\/messages\/thread-002\/response$/);
});
