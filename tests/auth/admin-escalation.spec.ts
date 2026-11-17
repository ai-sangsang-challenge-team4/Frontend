import { expect, test, type Page } from '@playwright/test';

// Runs against the mock escalation adapter (VITE_ESCALATION_API unset). It does not cover the real server.

const SESSION_KEY = 'teacher-hub.auth-session';
const EMERGENCY_THREAD = 'thread-001';
const EMERGENCY_TITLE = '상담 일정 및 조치 내용 확인 요청';
// thread-001 → mock complaintId 1
const EMERGENCY_ROW = '민원 #1 공유 메시지 상세 보기';
const SHARE_REASON = '보호자 상황 변화로 학교 차원의 공동 검토가 필요합니다.';

async function login(page: Page, role: 'TEACHER' | 'ADMIN') {
  await page.evaluate((key) => localStorage.removeItem(key), SESSION_KEY).catch(() => undefined);
  await page.goto(`/login?role=${role}`);
  await page.locator('input[name="email"]').fill(role === 'TEACHER' ? 'teacher@example.com' : 'admin@teacherhub.local');
  await page.locator('input[name="password"]').fill(role === 'TEACHER' ? 'password123' : 'admin1234');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page).toHaveURL(role === 'TEACHER' ? /\/teacher(?:\/messages)?$/ : /\/admin\/messages$/);
}

async function openDetailTab(page: Page, threadId: string, tab: string) {
  await page.goto(`/teacher/messages/${threadId}`);
  await page.getByRole('navigation', { name: '메시지 상세 탭' }).getByRole('button', { name: tab, exact: true }).click();
}

async function shareAsTeacher(page: Page) {
  await login(page, 'TEACHER');
  await openDetailTab(page, EMERGENCY_THREAD, '위험 요소');
  await expect(page.getByRole('heading', { name: '증빙 패키지', exact: true })).toHaveCount(0);
  const section = page.getByRole('region', { name: '관리자 공유' });
  await section.getByRole('button', { name: '관리자에게 공유' }).click();

  const dialog = page.getByRole('dialog', { name: '관리자에게 공유할까요?' });
  const submit = dialog.getByRole('button', { name: '공유하기', exact: true });
  await expect(submit).toBeDisabled();
  await dialog.getByLabel('공유 사유').fill(SHARE_REASON);
  await submit.click();
  await expect(dialog).toHaveCount(0);
  return section;
}

// After the first visit the row no longer reads 확인 대기.
async function openSharedAsAdminAgain(page: Page) {
  await login(page, 'ADMIN');
  await page.getByRole('link', { name: EMERGENCY_ROW }).click();
  await expect(page).toHaveURL(/\/admin\/messages\/\d+$/);
  return page.getByRole('region', { name: '처리 상태' });
}

async function openSharedAsAdmin(page: Page) {
  await login(page, 'ADMIN');
  const row = page.getByRole('link', { name: EMERGENCY_ROW });
  await expect(row).toContainText('확인 대기');
  await expect(row).toContainText(SHARE_REASON);
  await row.click();
  await expect(page).toHaveURL(/\/admin\/messages\/\d+$/);
  return page.getByRole('region', { name: '처리 상태' });
}

test('교사가 긴급 메시지를 사유와 함께 관리자에게 공유하면 공유 완료 상태가 표시된다', async ({ page }) => {
  const section = await shareAsTeacher(page);
  const scopes = await page.evaluate(() => JSON.parse(localStorage.getItem('teacher-hub.escalations.v4')!)[0].scopes);
  expect(scopes).toEqual(['MASKING_MESSAGES']);

  await expect(section.getByRole('button', { name: '공유 완료' })).toBeDisabled();
  await expect(section.getByText('관리자 확인 대기', { exact: true })).toBeVisible();
  await expect(section.getByText('긴급 (70점)')).toBeVisible();

  await page.getByRole('navigation', { name: '메시지 상세 탭' }).getByRole('button', { name: '처리 기록', exact: true }).click();
  await expect(page.getByRole('region', { name: '처리 기록' }).getByText('관리자 공유', { exact: true })).toBeVisible();

  await page.goto('/teacher/admin-share');
  await expect(page.getByRole('link', { name: EMERGENCY_TITLE })).toBeVisible();
});

for (const includeEvidence of [true, false]) {
  test(`공유 창에서 증빙을 준비하고 취소해도 공유되지 않으며 다시 열어 ${includeEvidence ? '첨부' : '첨부 없이 공유'}할 수 있다`, async ({ page }, testInfo) => {
    await login(page, 'TEACHER');
    await openDetailTab(page, EMERGENCY_THREAD, '위험 요소');
    const share = page.getByRole('region', { name: '관리자 공유' }).getByRole('button', { name: '관리자에게 공유', exact: true });
    await share.click();
    const dialog = page.getByRole('dialog', { name: '관리자에게 공유할까요?' });
    await dialog.getByLabel('공유 사유').fill(SHARE_REASON);
    await dialog.getByRole('button', { name: '증빙 패키지 생성 후 첨부', exact: true }).click();
    await expect(dialog.getByRole('checkbox', { name: '증빙 패키지', exact: true })).toBeChecked();
    await expect(dialog.getByRole('checkbox', { name: '원문 메시지', exact: true })).not.toBeChecked();
    await expect(dialog.getByLabel('공유 사유')).toHaveValue(SHARE_REASON);
    expect(await page.evaluate(() => localStorage.getItem('teacher-hub.escalations.v4'))).toBeNull();
    if (testInfo.project.name === 'mobile') await page.setViewportSize({ width: 320, height: 812 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await dialog.screenshot({ path: testInfo.outputPath('share-with-optional-evidence.png') });
    await dialog.getByRole('button', { name: '취소', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await share.click();
    await expect(dialog.getByRole('checkbox', { name: '증빙 패키지', exact: true })).not.toBeChecked();
    await expect(dialog.getByRole('checkbox', { name: '원문 메시지', exact: true })).not.toBeChecked();
    await expect(dialog.getByRole('button', { name: '증빙 패키지 생성 후 첨부', exact: true })).toHaveCount(0);
    await expect(dialog.getByLabel('공유 사유')).toHaveValue('');
    await dialog.getByLabel('공유 사유').fill(SHARE_REASON);
    if (includeEvidence) await dialog.getByRole('checkbox', { name: '증빙 패키지', exact: true }).check();
    await dialog.getByRole('button', { name: '공유하기', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    const scopes = await page.evaluate(() => JSON.parse(localStorage.getItem('teacher-hub.escalations.v4')!)[0].scopes);
    expect(scopes).toEqual(includeEvidence ? ['MASKING_MESSAGES', 'MEDIATION_PACKAGE'] : ['MASKING_MESSAGES']);
    await page.getByRole('navigation', { name: '메시지 상세 탭' }).getByRole('button', { name: '처리 기록', exact: true }).click();
    await expect(page.getByRole('region', { name: '처리 기록' }).getByText('증빙 패키지 생성', { exact: true })).toHaveCount(1);
  });
}

test('위험(High) 메시지는 공유 버튼이 비활성이고 일반 메시지에는 공유 섹션이 없다', async ({ page }) => {
  await login(page, 'TEACHER');
  await openDetailTab(page, 'thread-004', '위험 요소');
  const section = page.getByRole('region', { name: '관리자 공유' });
  await expect(section.getByText('현재 긴급 단계 메시지만 관리자에게 공유할 수 있습니다.')).toBeVisible();
  await expect(section.getByRole('button', { name: '관리자에게 공유' })).toBeDisabled();

  await openDetailTab(page, 'thread-003', '위험 요소');
  await expect(page.getByRole('region', { name: '관리자 공유' })).toHaveCount(0);
});

test('관리자는 공유받은 메시지를 확인하고 검토 중 → 처리 완료로 변경한다', async ({ page }) => {
  await shareAsTeacher(page);
  const processPanel = await openSharedAsAdmin(page);

  await expect(page.getByText(SHARE_REASON)).toBeVisible();
  await page.getByRole('navigation', { name: '공유 메시지 상세 탭' }).getByRole('button', { name: '위험 분석', exact: true }).click();
  await expect(page.getByText('확인된 위험 요소와 판단 근거')).toBeVisible();
  await expect(page.getByText('AI 분석 위험도', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'AI 위험도 설명', exact: true }).focus();
  await expect(page.getByRole('tooltip')).toContainText('최종 대응은 담당자의 검토');
  await page.keyboard.press('Escape');

  // The backend rejects a blank admin message, so the memo is required.
  const startReview = processPanel.getByRole('button', { name: '검토 시작', exact: true });
  await expect(startReview).toBeDisabled();
  await processPanel.getByLabel('처리 메모').fill('담당 교사와 통화 후 대응 방향 협의 예정');
  await startReview.click();
  await expect(processPanel.locator('[aria-current="step"]')).toHaveText(/검토 중/);

  await processPanel.getByLabel('처리 메모').fill('담당 교사와 대응 방향 협의 완료');
  await processPanel.getByRole('button', { name: '처리 완료', exact: true }).click();
  await page.getByRole('dialog', { name: '처리 완료로 변경할까요?' }).getByRole('button', { name: '처리 완료', exact: true }).click();
  await expect(processPanel.locator('[aria-current="step"]')).toHaveText(/처리 완료/);
  await expect(processPanel.getByRole('button', { name: '처리 완료', exact: true })).toHaveCount(0);

  await page.getByRole('navigation', { name: '공유 메시지 상세 탭' }).getByRole('button', { name: '처리 기록', exact: true }).click();
  const history = page.getByRole('region', { name: '처리 기록' });
  await expect(history.getByText('관리자 검토 완료', { exact: true })).toBeVisible();
  await expect(history.getByText('담당 교사와 대응 방향 협의 완료')).toBeVisible();

  await login(page, 'TEACHER');
  await openDetailTab(page, EMERGENCY_THREAD, '위험 요소');
  const section = page.getByRole('region', { name: '관리자 공유' });
  await expect(section.getByText('관리자 처리 완료', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '최근 긴급 재검토 요청 상세', exact: true }).click();
  const reviewDetails = page.locator('.board-risk-workflow-accordion');
  await expect(reviewDetails).toContainText('긴급 재검토 요청 내역이 없습니다.');
  await expect(reviewDetails.getByText('관리자 검토 결과', { exact: true })).toHaveCount(0);

  // Emergency review is independent of the share, so a completed share still takes a request.
  await page.getByRole('button', { name: '5점 위험', exact: true }).click();
  await page.getByPlaceholder('하향 수정 사유를 입력해주세요.').fill('공격적 표현이 일부 오탐입니다.');
  await page.getByRole('button', { name: '재검토 요청', exact: true }).click();
  await expect(section.getByText('관리자 승인 대기', { exact: true })).toBeVisible();
});

async function requestEmergencyDowngrade(page: Page) {
  await page.getByRole('button', { name: '5점 위험', exact: true }).click();
  await page.getByPlaceholder('하향 수정 사유를 입력해주세요.').fill('공격적 표현이 일부 오탐입니다.');
  await expect(page.getByRole('button', { name: '재검토 요청', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '재검토 요청', exact: true }).click();
}

test('거부 후 안전 잠금이 유지되어도 긴급 재검토를 다시 요청할 수 있다', async ({ page }) => {
  await shareAsTeacher(page);
  await requestEmergencyDowngrade(page);
  await expect(page.getByRole('region', { name: '관리자 공유' }).getByText('관리자 승인 대기', { exact: true })).toBeVisible();
  const processPanel = await openSharedAsAdmin(page);
  await processPanel.getByLabel('위험도 변경 결정 사유').fill('추가 근거가 필요합니다.');
  await processPanel.getByRole('button', { name: '위험도 변경 거부', exact: true }).click();
  await expect(processPanel.getByText('위험도 변경 반려됨')).toBeVisible();
  await login(page, 'TEACHER');
  await openDetailTab(page, EMERGENCY_THREAD, '위험 요소');
  await page.getByRole('button', { name: '최근 긴급 재검토 요청 상세', exact: true }).click();
  const reviewDetails = page.locator('.board-risk-workflow-accordion');
  await expect(reviewDetails).toContainText('반려 · 요청 위험도 미반영');
  await expect(reviewDetails.getByText('관리자 검토 위험도', { exact: true })).toHaveCount(0);
  await expect(page.locator('.board-card-meta').filter({ hasText: 'AI 분석 위험도' })).toContainText('긴급');
  await expect(reviewDetails.locator('dl > div').filter({ hasText: '현재 적용 위험도' })).toContainText('긴급');
  await expect(reviewDetails.locator('dl > div').filter({ hasText: '안전 잠금' })).toContainText('유지 중');
  await page.getByRole('button', { name: '5점 위험', exact: true }).click();
  await page.getByPlaceholder('하향 수정 사유를 입력해주세요.').fill('추가 근거를 확인했습니다.');
  const submit = page.getByRole('button', { name: '재검토 요청', exact: true });
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.getByRole('region', { name: '관리자 공유' }).getByText('관리자 승인 대기', { exact: true })).toBeVisible();
  await expect(page.locator('.board-risk-lock-review')).toHaveCount(0);
});

test('긴급 하향 승인 시 위험도와 안전 잠금 해제가 함께 반영된다', async ({ page }) => {
  await shareAsTeacher(page);
  await requestEmergencyDowngrade(page);
  const section = page.getByRole('region', { name: '관리자 공유' });
  await expect(section.getByText('관리자 승인 대기', { exact: true })).toBeVisible();
  await expect(section.getByText(/유지 중/)).toBeVisible();
  await expect(page.getByRole('button', { name: '검토자 확인 대기', exact: true })).toBeDisabled();
  await expect(page.locator('.board-risk-lock-review')).toHaveCount(0);
  await page.getByRole('button', { name: '최근 긴급 재검토 요청 상세', exact: true }).click();
  const reviewDetails = page.locator('.board-risk-workflow-accordion');
  await expect(reviewDetails).toContainText('요청한 위험도는 아직 반영되지 않았습니다.');
  await expect(reviewDetails.getByText('관리자 검토 결과', { exact: true })).toHaveCount(0);
  await expect(reviewDetails.getByText('관리자 검토 위험도', { exact: true })).toHaveCount(0);

  const processPanel = await openSharedAsAdmin(page);
  // The summary carries riskReviewStatus, so the decision is available on load.
  await expect(processPanel.getByText('위험도 변경 관리자 승인 대기')).toBeVisible();
  await expect(processPanel.getByText('안전 잠금 유지 중')).toBeVisible();
  await expect(processPanel.getByText('긴급(70점) → 위험(교사 검토 5/7단계)')).toBeVisible();
  await processPanel.getByLabel('처리 메모').fill('교사 하향 요청 사유 확인');
  await processPanel.getByRole('button', { name: '검토 시작', exact: true }).click();
  // Completion waits for the decision (server: 409 ESCALATION_STATE_INVALID).
  await expect(processPanel.locator('[aria-current="step"]')).toHaveText(/검토 중/);
  await expect(processPanel.getByRole('button', { name: '처리 완료', exact: true })).toHaveCount(0);

  const approve = processPanel.getByRole('button', { name: '위험도 변경 승인' });
  await expect(approve).toBeDisabled();
  await processPanel.getByLabel('위험도 변경 결정 사유').fill('교사 판단이 타당합니다.');
  await approve.click();
  await expect(processPanel.getByText('위험도 변경 반영됨')).toBeVisible();
  await expect(processPanel.getByRole('button', { name: '처리 완료', exact: true })).toBeVisible();
  await expect(processPanel.getByText('안전 잠금 유지 중')).toHaveCount(0);
  await expect(processPanel.getByRole('button', { name: '안전 잠금 해제', exact: true })).toHaveCount(0);

  await login(page, 'TEACHER');
  await openDetailTab(page, EMERGENCY_THREAD, '위험 요소');
  const teacherSection = page.getByRole('region', { name: '관리자 공유' });
  await page.getByRole('button', { name: '최근 긴급 재검토 요청 상세', exact: true }).click();
  await expect(reviewDetails).toContainText('승인 · 요청 위험도 반영 완료');
  await expect(page.locator('.board-card-meta').filter({ hasText: 'AI 분석 위험도' })).toContainText('긴급');
  await expect(reviewDetails.locator('dl > div').filter({ hasText: '관리자 검토 위험도' })).toContainText('위험');
  await expect(reviewDetails.locator('dl > div').filter({ hasText: '현재 적용 위험도' })).toContainText('위험');
  await expect(reviewDetails.getByText('검토 완료 시각', { exact: true })).toBeVisible();
  await expect(teacherSection.getByText('위험 (50점)')).toBeVisible();
  await expect(teacherSection.getByText(/유지 중/)).toHaveCount(0);
  await expect(page.locator('.board-risk-lock-review')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '검토자 확인 대기', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '5점 위험', exact: true }).click();
  await expect(page.getByRole('button', { name: '검토 완료', exact: true })).toBeVisible();
  await openSharedAsAdminAgain(page);

  await page.getByRole('navigation', { name: '공유 메시지 상세 탭' }).getByRole('button', { name: '처리 기록', exact: true }).click();
  const history = page.getByRole('region', { name: '처리 기록' });
  await expect(history.getByText('긴급 위험도 재검토 요청', { exact: true })).toBeVisible();
  await expect(history.getByText('긴급 위험도 재검토 승인', { exact: true })).toBeVisible();
  await expect(history.getByText('안전 잠금 변경', { exact: true })).toBeVisible();
});

test('검토 시작 후에 들어온 하향 요청도 관리자가 새로고침하면 결정할 수 있고, 결정 전에는 완료할 수 없다', async ({ page }) => {
  await shareAsTeacher(page);
  const processPanel = await openSharedAsAdmin(page);
  await processPanel.getByLabel('처리 메모').fill('담당 교사와 통화 예정');
  await processPanel.getByRole('button', { name: '검토 시작', exact: true }).click();
  await expect(processPanel.locator('[aria-current="step"]')).toHaveText(/검토 중/);
  await expect(processPanel.getByRole('button', { name: '처리 완료', exact: true })).toBeVisible();

  await login(page, 'TEACHER');
  await openDetailTab(page, EMERGENCY_THREAD, '위험 요소');
  await requestEmergencyDowngrade(page);
  await expect(page.getByRole('region', { name: '관리자 공유' }).getByText('관리자 승인 대기', { exact: true })).toBeVisible();

  // The summary carries riskReviewStatus, so a reload alone shows the pending request.
  const adminPanel = await openSharedAsAdminAgain(page);
  await page.reload();
  await expect(adminPanel.getByText('위험도 변경 관리자 승인 대기')).toBeVisible();
  await expect(adminPanel.getByRole('button', { name: '처리 완료', exact: true })).toHaveCount(0);
  await adminPanel.getByLabel('위험도 변경 결정 사유').fill('교사 판단이 타당합니다.');
  await adminPanel.getByRole('button', { name: '위험도 변경 승인' }).click();
  await expect(adminPanel.getByText('위험도 변경 반영됨')).toBeVisible();
  await expect(adminPanel.getByRole('button', { name: '처리 완료', exact: true })).toBeVisible();
});

test('공유하지 않은 긴급 메시지도 위험도 하향을 요청하면 관리자 승인 대기가 된다', async ({ page }) => {
  await login(page, 'TEACHER');
  await openDetailTab(page, EMERGENCY_THREAD, '위험 요소');
  await requestEmergencyDowngrade(page);
  const section = page.getByRole('region', { name: '관리자 공유' });
  await expect(section.getByText('관리자 승인 대기', { exact: true })).toBeVisible();
  // Sharing is still available: the level stays EMERGENCY until the reviewer applies the request.
  await expect(section.getByRole('button', { name: '관리자에게 공유' })).toBeEnabled();
});

test('관리자는 공유되지 않은 메시지에 접근할 수 없고 교사는 관리자 화면에 들어갈 수 없다', async ({ page }) => {
  await login(page, 'ADMIN');
  await expect(page.getByText('공유받은 메시지가 없습니다')).toBeVisible();

  await page.goto('/admin/messages/9999');
  await expect(page.getByText('404', { exact: true })).toBeVisible();
  await page.goto('/admin/messages/thread-001');
  await expect(page.getByText('404', { exact: true })).toBeVisible();

  await login(page, 'TEACHER');
  await page.goto('/admin/messages');
  await expect(page).toHaveURL(/\/teacher(?:\/messages)?$/);
});
