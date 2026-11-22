import { expect, test, type Page } from '@playwright/test';

function list(content: unknown[], page = 0, hasNext = false) {
  return { content, page, size: 10, totalElements: content.length, totalPages: hasNext ? page + 2 : page + 1,
    first: page === 0, last: !hasNext, hasNext, hasPrevious: page > 0 };
}

function item(id: number, status = 'OPEN') {
  return { complaintId: id, title: `학교 문의 ${id}`, studentId: 1, studentName: '학생',
    counterpartName: '보호자', counterpartRole: 'PARENT', academicYear: 2026, grade: 3, classNo: 1,
    status, waitingFor: status === 'ANSWERED' ? 'PARENT' : 'TEACHER', riskAnalysisId: id,
    riskLevel: 'LOW', aiSummary: '학교 일정 문의', latestReceivedAt: '2026-11-22T09:00:00' };
}

async function session(page: Page, role: 'PARENT' | 'TEACHER') {
  const user = { userId: 201, name: '테스트 사용자', email: 'ui@example.com', role };
  await page.addInitScript((user) => {
    localStorage.setItem('teacher-hub.auth-session', JSON.stringify({
      accessToken: 'fixture-token', expiresAt: Date.now() + 3600_000, user,
    }));
  }, user);
  return user;
}

test('불완전 기록을 안내하고 모든 위험 근거를 표시한다', async ({ page }) => {
  const user = await session(page, 'TEACHER');
  let complete = false;
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const path = new URL(route.request().url()).pathname.slice(4);
    if (path === '/users/me') return route.fulfill({ json: user });
    if (path === '/teacher/complaints') return route.fulfill({ json: list([item(1)]) });
    if (path === '/teacher/complaints/1') return route.fulfill({ json: { ...item(1), parentName: '보호자', submittedAt: '2026-11-22T09:00:00' } });
    if (path.endsWith('/messages')) return route.fulfill({ json: { complaintId: 1, allowedActions: ['VIEW_ORIGINAL', 'WRITE_REPLY'], messages: [
      { messageId: 'message:1', senderRole: 'PARENT', senderName: '보호자', content: '첫 번째 근거 그리고 두 번째 근거', sentAt: '2026-11-22T09:00:00', summarized: false },
    ] } });
    if (path.endsWith('/risk')) return route.fulfill({ json: {
      complaintId: 1, riskAnalysisId: 1, riskScore: 10, riskLevel: 'LOW', currentRiskScore: 10,
      currentRiskLevel: 'LOW', reviewScale: null, reviewScore: null, reviewLevel: null, latestReview: null,
      analyzedAt: '2026-11-22T09:00:00', safetyLock: false, detectedFactors: [
        { code: 'THREAT', name: '위협', state: 'BOUNDARY', reason: '문맥 확인', evidenceSpans: [
          { text: '첫 번째 근거', start: 0, end: 7 }, { text: '두 번째 근거', start: 12, end: 19 },
        ] },
      ],
    } });
    if (path.endsWith('/history')) return route.fulfill({ json: { complaintId: 1, events: [], logComplete: complete,
      missingLogs: complete ? [] : [{ expectedType: 'RISK_ANALYZED', description: '위험 분석 기록 누락' }],
    } });
    if (path.endsWith('/escalation')) return route.fulfill({ json: { escalationId: null, emergencyReviewRequestId: null,
      escalationStatus: 'NOT_SHARED', riskReviewStatus: null, currentRiskScore: 10, currentRiskLevel: 'LOW', safetyLock: false } });
    if (path.endsWith('/response-draft')) return route.fulfill({ status: 404, json: { message: '초안 없음' } });
    if (path.endsWith('/emergency-review/current')) return route.fulfill({ status: 404, json: { message: '검토 없음' } });
    throw new Error(`Unexpected API request ${path}`);
  });
  await page.goto('/teacher/messages/1');
  await page.getByRole('button', { name: '처리 기록', exact: true }).click();
  await expect(page.getByText('일부 처리 기록이 누락되어 있습니다.', { exact: false })).toBeVisible();
  await expect(page.getByText('위험 분석 기록 누락', { exact: true })).toBeVisible();
  await expect(page.getByText('처리 기록이 없습니다', { exact: true })).toHaveCount(0);
  complete = true;
  await page.getByRole('button', { name: '기록 다시 불러오기' }).click();
  await expect(page.getByText('처리 기록이 없습니다', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '위험 요소', exact: true }).click();
  await page.getByRole('button', { name: '확인된 위험 요소와 판단 근거', exact: true }).click();
  await page.getByRole('button', { name: /위협.*경계/ }).click();
  await expect(page.locator('.board-factor-evidence')).toHaveCount(2);
  await expect(page.locator('.board-factor-evidence').nth(1)).toContainText('두 번째 근거');
  await expect(page.getByRole('button', { name: '원문에서 근거 확인' })).toHaveCount(2);
});

test('서버 검색 결과와 다음 페이지를 표시하고 빠른 검색어 복원도 재조회한다', async ({ page }) => {
  const user = await session(page, 'PARENT');
  const keywords: string[] = [];
  let failNextPage = true;
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.slice(4);
    if (path === '/users/me') return route.fulfill({ json: user });
    if (path === '/complaints') {
      const keyword = url.searchParams.get('keyword') ?? '';
      keywords.push(keyword);
      const pageNumber = Number(url.searchParams.get('page'));
      if (pageNumber === 1 && failNextPage) {
        failNextPage = false;
        return route.fulfill({ status: 503, json: { message: '목록 조회 실패' } });
      }
      // Only the server knows that this inquiry matches a reply's contents.
      const id = keyword ? 300 : pageNumber === 0 ? 1 : 211;
      return route.fulfill({ json: list([item(id)], pageNumber, !keyword && pageNumber === 0) });
    }
    const match = path.match(/^\/complaints\/(\d+)$/);
    if (match) return route.fulfill({ json: { ...item(Number(match[1])), teacherName: '교사', parentName: '보호자',
      content: '처음 작성한 내용', createdAt: '2026-11-22T09:00:00', updatedAt: '2026-11-22T09:00:00' } });
    throw new Error(`Unexpected API request ${path}`);
  });
  await page.goto('/parent/messages');
  await expect(page.getByRole('link', { name: /학교 문의 1/ })).toBeVisible();
  await page.getByRole('button', { name: '문의 더 보기' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: '다시 불러오기' }).click();
  await expect(page.getByRole('link', { name: /학교 문의 211/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /학교 문의 1/ })).toBeVisible();
  const search = page.getByRole('searchbox', { name: '문의 검색' });
  await search.fill('reply');
  await expect(page.getByRole('link', { name: /학교 문의 300/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /학교 문의 211/ })).toHaveCount(0);
  const before = keywords.filter((value) => value === 'reply').length;
  // Both changes occur before the 300ms debounce; the previous request was aborted.
  await search.fill('other');
  await search.fill('reply');
  await expect.poll(() => keywords.filter((value) => value === 'reply').length).toBeGreaterThan(before);
  await expect(page.getByRole('link', { name: /학교 문의 300/ })).toBeVisible();
});
