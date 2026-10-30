import { expect, test, type Page, type Route } from '@playwright/test';

const review = {
  requestId: 9, complaintId: 12, riskAnalysisId: 4,
  previousRiskScale: 7, previousRiskScore: 70, previousRiskLevel: 'EMERGENCY',
  requestedRiskScale: 5, requestedRiskScore: 50, requestedRiskLevel: 'HIGH',
  reason: '추가 근거를 확인했습니다.', status: 'PENDING_ADMIN_APPROVAL', safetyLock: true,
  reviewerId: 301, reviewerName: '지정 관리자', requestedAt: '2026-10-30T10:00:00',
  decidedAt: null as string | null, safetyLockUpdatedAt: '2026-10-30T10:00:00',
};

async function setup(page: Page, role: 'ADMIN' | 'TEACHER', handler: (route: Route, key: string) => Promise<boolean>) {
  const user = { userId: role === 'ADMIN' ? 301 : 201, name: '테스트 사용자', email: 'test@example.com', role };
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const request = route.request();
    const key = `${request.method()} ${new URL(request.url()).pathname.slice(4)}`;
    if (key === 'POST /auth/login') return route.fulfill({ json: { accessToken: 'test-jwt', expiresIn: 3600, user } });
    if (key === 'GET /users/me') return route.fulfill({ json: user });
    if (key === 'GET /admin/escalations') return route.fulfill({ json: [] });
    if (await handler(route, key)) return;
    throw new Error(`Unexpected API request: ${key}`);
  });
  await page.goto(`/login?role=${role}`);
  await page.locator('input[name="email"]').fill(user.email);
  await page.locator('input[name="password"]').fill('password123');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page).toHaveURL(role === 'ADMIN' ? /\/admin\/messages$/ : /\/teacher(?:\/messages)?$/);
}

test('동의 조회 실패 재시도와 명시적 필수 동의, 선택 동의 변경을 HTTP로 처리한다', async ({ page }) => {
  let failRead = true;
  let failSave = true;
  let writes = 0;
  let consent = { consentId: null as number | null, policyVersion: '2026-v2', agreedAt: null as string | null, requiredAgreed: false, optionalAgreed: false };
  await setup(page, 'ADMIN', async (route, key) => {
    if (key === 'GET /users/me/policy-consents') {
      await route.fulfill(failRead ? { status: 503, json: { message: '동의 조회 지연' } } : { json: consent });
      failRead = false;
      return true;
    }
    if (key === 'POST /users/me/policy-consents') {
      writes += 1;
      expect(route.request().postDataJSON()).toEqual({ requiredAgreed: true, optionalAgreed: writes < 3 });
      if (failSave) {
        failSave = false;
        await route.fulfill({ status: 503, json: { message: '동의 저장 지연' } });
      } else {
        consent = { ...consent, consentId: 1, requiredAgreed: true, optionalAgreed: writes < 3, agreedAt: '2026-10-30T12:00:00' };
        await route.fulfill({ json: consent });
      }
      return true;
    }
    return false;
  });
  await page.goto('/admin/mypage');
  await page.getByRole('tab', { name: '약관 및 동의' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: '다시 불러오기' }).click();
  await expect(page.getByText('2026-v2', { exact: true })).toBeVisible();
  const save = page.getByRole('button', { name: '동의 내용 저장' });
  await expect(save).toBeDisabled();
  expect(writes).toBe(0);
  await page.getByRole('checkbox', { name: /서비스 이용약관/ }).check();
  await page.getByRole('checkbox', { name: /메시지 원문 저장/ }).check();
  await save.click();
  await expect(page.getByRole('alert')).toBeVisible();
  await save.click();
  await expect(page.getByText('동의 내용이 저장되었습니다.')).toBeVisible();
  await page.getByRole('checkbox', { name: /메시지 원문 저장/ }).uncheck();
  await save.click();
  await expect(page.getByText('동의 내용이 저장되었습니다.')).toBeVisible();
  await page.reload();
  await page.getByRole('tab', { name: '약관 및 동의' }).click();
  await expect(page.getByRole('checkbox', { name: /메시지 원문 저장/ })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: /서비스 이용약관/ })).toBeChecked();
});

test('공유되지 않은 긴급 재검토 요청을 목록에서 발견해 승인하고 잠금은 별도로 해제한다', async ({ page }) => {
  let current = { ...review };
  await setup(page, 'ADMIN', async (route, key) => {
    if (key === 'GET /admin/emergency-review') { await route.fulfill({ json: [current] }); return true; }
    if (key === 'GET /admin/emergency-review/9') { await route.fulfill({ json: current }); return true; }
    if (key === 'PATCH /admin/emergency-review/9') {
      const request = route.request().postDataJSON();
      if (request.status) {
        expect(request).toEqual({ status: 'APPLIED', message: '근거를 확인했습니다.' });
        current = { ...current, status: request.status, decidedAt: '2026-10-30T12:00:00' };
      } else { expect(request).toEqual({ safetyLock: false }); current = { ...current, safetyLock: false }; }
      await route.fulfill({ json: current }); return true;
    }
    return false;
  });
  await page.goto('/admin/emergency-reviews');
  await page.getByRole('link', { name: /민원 #12 · 재검토 #9/ }).click();
  await expect(page.getByText('지정 관리자')).toBeVisible();
  await page.getByLabel('위험도 변경 결정 사유').fill('근거를 확인했습니다.');
  await page.getByRole('button', { name: '위험도 변경 승인' }).click();
  await expect(page.getByText('재검토 결정을 저장했습니다.')).toBeVisible();
  expect(current.safetyLock).toBe(true);
  await page.getByRole('button', { name: '안전 잠금 해제' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '잠금 해제', exact: true }).click();
  await expect(page.getByText('안전 잠금 해제됨')).toBeVisible();
  await page.getByRole('link', { name: '재검토 목록으로' }).click();
  await page.getByRole('checkbox', { name: '승인 대기만 보기' }).check();
  await expect(page.getByText('현재 승인을 기다리는 요청이 없습니다.')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('최신 거부 요청의 잠금이 유지되어도 교사가 재요청하며 승인 대기 중에는 중복을 막는다', async ({ page }) => {
  let current = { ...review, status: 'REJECTED', decidedAt: '2026-10-30T11:00:00' as string | null };
  const calls: string[] = [];
  await setup(page, 'TEACHER', async (route, key) => {
    calls.push(key);
    let json: unknown;
    switch (key) {
      case 'GET /teacher/complaints': json = { content: [{ complaintId: 12, title: '긴급 문의', studentName: '학생', counterpartName: '학부모', status: 'OPEN', waitingFor: 'TEACHER', riskLevel: 'EMERGENCY', aiSummary: '문의 요약', latestReceivedAt: '2026-10-30T09:00:00', grade: 3, classNo: 1 }], page: 0, size: 10, totalElements: 1, totalPages: 1, hasNext: false }; break;
      case 'GET /teacher/complaints/12': json = { complaintId: 12, title: '긴급 문의', studentName: '학생', parentName: '학부모', status: 'OPEN', waitingFor: 'TEACHER', riskLevel: 'EMERGENCY', submittedAt: '2026-10-30T09:00:00', grade: 3, classNo: 1 }; break;
      case 'GET /teacher/complaints/12/messages': json = { complaintId: 12, allowedActions: [], messages: [{ messageId: 'message:1', senderRole: 'PARENT', senderName: '학부모', content: '문의 요약', sentAt: '2026-10-30T09:00:00', summarized: true }] }; break;
      case 'GET /teacher/complaints/12/risk': json = { complaintId: 12, riskAnalysisId: 4, riskScore: 70, riskLevel: 'EMERGENCY', currentRiskScore: 70, currentRiskLevel: 'EMERGENCY', reviewScale: null, reviewScore: null, reviewLevel: null, latestReview: null, analyzedAt: '2026-10-30T09:00:00', safetyLock: true, detectedFactors: [] }; break;
      case 'GET /teacher/complaints/12/history': json = { complaintId: 12, events: [], logComplete: true }; break;
      case 'GET /teacher/complaints/12/escalation': json = { escalationId: null, emergencyReviewRequestId: current.requestId, escalationStatus: 'NOT_SHARED', riskReviewStatus: current.status, currentRiskScore: 70, currentRiskLevel: 'EMERGENCY', safetyLock: true }; break;
      case 'GET /teacher/complaints/12/emergency-review/current': json = current; break;
      case 'POST /teacher/complaints/12/emergency-review':
        expect(route.request().postDataJSON()).toEqual({ reason: '추가 근거를 확인했습니다.', riskScore: 5 });
        current = { ...current, requestId: 10, status: 'PENDING_ADMIN_APPROVAL', decidedAt: null };
        json = current; break;
      default: return false;
    }
    await route.fulfill({ json }); return true;
  });
  await page.goto('/teacher/messages/12');
  await page.getByRole('navigation', { name: '메시지 상세 탭' }).getByRole('button', { name: '위험 요소', exact: true }).click();
  await page.getByText('최근 긴급 재검토 요청 상세', { exact: true }).click();
  await expect(page.getByText('지정 관리자', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '5점 위험', exact: true }).click();
  await page.getByPlaceholder('하향 수정 사유를 입력해주세요.').fill('추가 근거를 확인했습니다.');
  await page.getByRole('button', { name: '확인 요청', exact: true }).click();
  await expect(page.getByRole('region', { name: '관리자 공유' }).getByText('관리자 승인 대기', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '검토 완료', exact: true })).toBeDisabled();
  expect(calls).toContain('POST /teacher/complaints/12/emergency-review');
  expect(calls).not.toContain('POST /teacher/complaints/12/risk-reviews');
  await expect(page.getByText('현재 답변 작성이 제한되어 있습니다.')).toBeVisible();
});
