import { expect, test, type Page } from '@playwright/test';
import type { TeacherEscalationSummaryResponse } from '../../src/features/escalation/escalationTypes';

// HTTP adapter UI checks against the deployed TeacherEscalationPageResponse contract.
// Requests are intercepted; no live backend data is changed.
const items: TeacherEscalationSummaryResponse[] = Array.from({ length: 12 }, (_, index) => ({
  escalationId: 100 + index,
  complaintId: 12 + index,
  complaintTitle: `학교 공동 검토 요청 ${index + 1}`,
  studentName: index === 11 ? '김하은' : `테스트학생${index + 1}`,
  assignedAdminName: '지정 관리자',
  reason: `학교 차원의 검토가 필요합니다. ${index + 1}`,
  sharedScopes: ['MASKING_MESSAGES'],
  escalationStatus: index < 10 ? 'SHARED' : index === 10 ? 'UNDER_REVIEW' : 'COMPLETED',
  currentRiskLevel: index === 11 ? 'HIGH' : 'EMERGENCY',
  currentRiskScore: index === 11 ? 60 : 70,
  emergencyReviewRequestId: null,
  riskReviewStatus: null,
  safetyLock: true,
  sharedAt: '2026-11-17T10:00:00',
  reviewStartedAt: null,
  completedAt: null,
}));

async function setup(page: Page) {
  const calls: URL[] = [];
  let currentItems = items;
  let fail = false;
  let delayedKeyword = '';
  let completedDelayedRequests = 0;
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/api/teacher/escalations**', async (route) => {
    const url = new URL(route.request().url());
    calls.push(url);
    const isDelayed = delayedKeyword && url.searchParams.get('keyword') === delayedKeyword;
    if (isDelayed) await gate;
    if (fail) return route.fulfill({ status: 503, json: { message: '잠시 후 다시 시도해 주세요.' } });
    const keyword = url.searchParams.get('keyword') ?? '';
    const filtered = currentItems.filter((item) =>
      (!url.searchParams.has('status') || item.escalationStatus === url.searchParams.get('status')) &&
      (!url.searchParams.has('riskLevel') || item.currentRiskLevel === url.searchParams.get('riskLevel')) &&
      `${item.complaintTitle} ${item.studentName}`.includes(keyword));
    const currentPage = Number(url.searchParams.get('page') ?? 0);
    const totalPages = Math.ceil(filtered.length / 10);
    await route.fulfill({ json: {
      content: filtered.slice(currentPage * 10, (currentPage + 1) * 10),
      page: currentPage, size: 10, totalElements: filtered.length, totalPages,
      first: currentPage === 0, last: currentPage + 1 >= totalPages,
      hasNext: currentPage + 1 < totalPages, hasPrevious: currentPage > 0,
    } });
    if (isDelayed) completedDelayedRequests += 1;
  });
  await page.goto('/login?role=TEACHER');
  await page.locator('input[name="email"]').fill('teacher@example.com');
  await page.locator('input[name="password"]').fill('password123');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page).toHaveURL(/\/teacher(?:\/messages)?$/);
  await page.goto('/teacher/admin-share');
  return {
    calls,
    setItems: (value: TeacherEscalationSummaryResponse[]) => { currentItems = value; },
    setFailure: (value: boolean) => { fail = value; },
    delay: (keyword: string) => { delayedKeyword = keyword; },
    release: () => release?.(),
    completedDelayedRequests: () => completedDelayedRequests,
  };
}

const rows = (page: Page) => page.getByRole('region', { name: '관리자에게 공유한 메시지 목록', exact: true });

test('서버 전체 건수와 페이지를 표시하고 상태 전환 시 첫 페이지를 조회한다', async ({ page }) => {
  const { calls } = await setup(page);
  await expect(page.getByRole('tab', { name: '전체 12', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: '검토 중 1', exact: true })).toBeVisible();
  await expect(rows(page).getByRole('link')).toHaveCount(10);
  await expect(page.getByText('테스트학생1 학생 · 담당 관리자: 지정 관리자', { exact: true })).toBeVisible();
  await expect(page.getByText('공유 사유: 학교 차원의 검토가 필요합니다. 1', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '이전 페이지', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '다음 페이지', exact: true }).click();
  await expect(rows(page).getByRole('link')).toHaveCount(2);
  await expect(page.getByRole('button', { name: '다음 페이지', exact: true })).toBeDisabled();
  expect(calls.some((url) => url.searchParams.get('page') === '1' && !url.searchParams.has('status'))).toBe(true);
  await page.getByRole('tab', { name: '검토 중 1', exact: true }).click();
  await expect(rows(page).getByRole('link')).toHaveCount(1);
  await expect(rows(page)).toContainText('관리자 검토 중');
  await expect(rows(page).getByRole('link')).toHaveAccessibleName(
    /학교 공동 검토 요청 11\s+긴급\s+테스트학생11 학생.*관리자 검토 중.*10:00 공유/,
  );
  expect(calls.some((url) => url.searchParams.get('page') === '0' && url.searchParams.get('status') === 'UNDER_REVIEW')).toBe(true);
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: '처리 완료 1', exact: true })).toBeFocused();
  await expect(rows(page)).toContainText('관리자 처리 완료');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('위험도와 학생명 검색을 서버에 전달하고 검색 결과 없음 상태를 구분한다', async ({ page }) => {
  const { calls } = await setup(page);
  await expect(page.getByRole('tab', { name: '전체 12', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '위험도 필터', exact: true }).click();
  await page.getByRole('option', { name: '위험', exact: true }).click();
  await expect(page.getByRole('tab', { name: '전체 1', exact: true })).toBeVisible();
  await page.getByRole('searchbox', { name: '민원 제목 또는 학생명', exact: true }).fill('  김하은  ');
  await page.getByRole('button', { name: '검색', exact: true }).click();
  await expect(rows(page)).toContainText('김하은 학생');
  await expect.poll(() => calls.some((url) => url.searchParams.get('keyword') === '김하은' && url.searchParams.get('riskLevel') === 'HIGH')).toBe(true);
  await page.getByRole('tab', { name: '검토 중 0', exact: true }).click();
  await expect(page.getByRole('heading', { name: '조건에 맞는 공유 메시지가 없습니다', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '공유 내역을 불러올 수 없습니다', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('필터 조회가 실패하면 이전 목록을 숨기고 재시도할 수 있다', async ({ page }) => {
  const fixture = await setup(page);
  await expect(rows(page).getByRole('link')).toHaveCount(10);
  fixture.setFailure(true);
  await page.getByRole('tab', { name: '검토 중 1', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('region', { name: '관리자에게 공유한 메시지 목록', exact: true })).toHaveCount(0);
  fixture.setFailure(false);
  await page.getByRole('button', { name: '다시 시도하기', exact: true }).click();
  await expect(rows(page).getByRole('link')).toHaveCount(1);
  await expect(rows(page)).toContainText('관리자 검토 중');
});

test('늦게 도착한 검색 응답이 현재 검색 결과를 덮지 않는다', async ({ page }) => {
  const fixture = await setup(page);
  await expect(rows(page).getByRole('link')).toHaveCount(10);
  fixture.delay('테스트학생');
  const search = page.getByRole('searchbox', { name: '민원 제목 또는 학생명', exact: true });
  await search.fill('테스트학생');
  await page.getByRole('button', { name: '검색', exact: true }).click();
  await expect.poll(() => fixture.calls.filter((url) => url.searchParams.get('keyword') === '테스트학생').length).toBe(4);
  await search.fill('김하은');
  await page.getByRole('button', { name: '검색', exact: true }).click();
  await expect(rows(page)).toContainText('김하은 학생');
  fixture.release();
  await expect.poll(fixture.completedDelayedRequests).toBe(4);
  await expect(rows(page).getByRole('link')).toHaveCount(1);
  await expect(rows(page)).toContainText('김하은 학생');
  await expect(rows(page)).not.toContainText('테스트학생');
});

test('페이지 조회 중 공유 내역이 줄면 마지막 유효 페이지로 복귀한다', async ({ page }) => {
  const fixture = await setup(page);
  await expect(page.getByRole('tab', { name: '전체 12', exact: true })).toBeVisible();
  fixture.setItems(items.slice(0, 10));
  await page.getByRole('button', { name: '다음 페이지', exact: true }).click();
  await expect(rows(page).getByRole('link')).toHaveCount(10);
  await expect(page.getByRole('tab', { name: '전체 10', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '관리자에게 공유한 메시지가 없습니다', exact: true })).toHaveCount(0);
  expect(fixture.calls.some((url) => url.searchParams.get('page') === '1' && !url.searchParams.has('status'))).toBe(true);
  expect(fixture.calls.at(-4)?.searchParams.get('page')).toBe('0');
});
