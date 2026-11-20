import { expect, test, type Page, type Route } from '@playwright/test';
import type { TeacherEscalationPageResponse } from '../../src/features/escalation/escalationTypes';

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

test('동의 조회 실패 재시도와 명시적 필수 동의, 선택 동의 변경을 HTTP로 처리한다', async ({ page }, testInfo) => {
  let failRead = true;
  let failSave = true;
  let writes = 0;
  let completeSave: () => void = () => {};
  const saveGate = new Promise<void>((resolve) => { completeSave = resolve; });
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
        if (writes === 2) await saveGate;
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
  const panel = page.getByRole('region', { name: '동의 현황', exact: true });
  const status = panel.getByRole('status');
  await expect(status).toContainText('필수 약관 동의가 필요해요.');
  for (const width of [320, 375, 620, 980, 1440]) {
    await page.setViewportSize({ width, height: 1100 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px consent layout`).toBe(true);
  }
  await panel.screenshot({ path: testInfo.outputPath('consent-desktop.png') });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath('consent-mobile.png'), fullPage: true });
  await page.setViewportSize(testInfo.project.name === 'mobile' ? { width: 393, height: 851 } : { width: 1280, height: 720 });
  const save = page.getByRole('button', { name: '동의 내용 저장' });
  await expect(save).toBeDisabled();
  expect(writes).toBe(0);
  await page.getByRole('checkbox', { name: /서비스 이용약관/ }).check();
  await page.getByRole('checkbox', { name: /메시지 활용/ }).check();
  await expect(status).toContainText('변경한 동의 내용이 아직 저장되지 않았어요.');
  await expect(panel.locator('dl > div').filter({ hasText: '필수 동의' }).locator('dd')).toHaveText('미동의');
  await expect(page.getByRole('checkbox', { name: /메시지 활용/ })).toHaveAccessibleDescription(/거부해도 서비스를 이용/);
  await save.click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(status).toContainText('변경한 동의 내용이 아직 저장되지 않았어요.');
  await expect(status).not.toContainText('저장되었습니다');
  await save.click();
  await expect(status).toContainText('동의 내용을 저장하고 있어요.');
  await expect(page.getByRole('button', { name: '저장 중…', exact: true })).toBeDisabled();
  await expect(page.getByRole('checkbox', { name: /서비스 이용약관/ })).toBeDisabled();
  completeSave();
  await expect(page.getByText('동의 내용이 저장되었습니다.')).toBeVisible();
  await page.getByRole('checkbox', { name: /메시지 활용/ }).uncheck();
  await save.click();
  await expect(page.getByText('동의 내용이 저장되었습니다.')).toBeVisible();
  await page.reload();
  await page.getByRole('tab', { name: '약관 및 동의' }).click();
  await expect(status).toContainText('필수 약관에 동의한 상태예요.');
  await expect(page.getByRole('checkbox', { name: /메시지 활용/ })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: /서비스 이용약관/ })).toBeChecked();
});

test('공유되지 않은 긴급 재검토도 승인 응답의 잠금 해제를 표시하고 추가 해제를 요청하지 않는다', async ({ page }) => {
  let current = { ...review };
  await setup(page, 'ADMIN', async (route, key) => {
    if (key === 'GET /admin/emergency-review') { await route.fulfill({ json: [current] }); return true; }
    if (key === 'GET /admin/emergency-review/9') { await route.fulfill({ json: current }); return true; }
    if (key === 'PATCH /admin/emergency-review/9') {
      const request = route.request().postDataJSON();
      if (request.status) {
        expect(request).toEqual({ status: 'APPLIED', message: '근거를 확인했습니다.' });
        current = { ...current, status: request.status, safetyLock: false, decidedAt: '2026-10-30T12:00:00' };
      } else { throw new Error('승인 뒤 별도 잠금 해제 요청을 보내면 안 됩니다.'); }
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
  expect(current.safetyLock).toBe(false);
  await expect(page.getByRole('button', { name: '안전 잠금 해제' })).toHaveCount(0);
  await expect(page.getByText('안전 잠금 해제됨')).toBeVisible();
  await page.getByRole('link', { name: '재검토 목록으로' }).click();
  await page.getByRole('checkbox', { name: '승인 대기만 보기' }).check();
  await expect(page.getByText('현재 승인을 기다리는 요청이 없습니다.')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

function teacherComplaintJson(key: string, current: typeof review): unknown {
  switch (key) {
    case 'GET /teacher/complaints': return { content: [{ complaintId: 12, title: '긴급 문의', studentName: '학생', counterpartName: '학부모', status: 'OPEN', waitingFor: 'TEACHER', riskLevel: 'EMERGENCY', aiSummary: '문의 요약', latestReceivedAt: '2026-10-30T09:00:00', grade: 3, classNo: 1 }], page: 0, size: 10, totalElements: 1, totalPages: 1, hasNext: false };
    case 'GET /teacher/complaints/12': return { complaintId: 12, title: '긴급 문의', studentName: '학생', parentName: '학부모', status: 'OPEN', waitingFor: 'TEACHER', riskLevel: 'EMERGENCY', submittedAt: '2026-10-30T09:00:00', grade: 3, classNo: 1 };
    case 'GET /teacher/complaints/12/messages': return { complaintId: 12, allowedActions: [], messages: [{ messageId: 'message:1', senderRole: 'PARENT', senderName: '학부모', content: '문의 요약', sentAt: '2026-10-30T09:00:00', summarized: true }] };
    case 'GET /teacher/complaints/12/risk': return { complaintId: 12, riskAnalysisId: 4, riskScore: 70, riskLevel: 'EMERGENCY', currentRiskScore: 70, currentRiskLevel: 'EMERGENCY', reviewScale: null, reviewScore: null, reviewLevel: null, latestReview: null, analyzedAt: '2026-10-30T09:00:00', safetyLock: true, detectedFactors: [] };
    case 'GET /teacher/complaints/12/history': return { complaintId: 12, events: [], logComplete: true };
    case 'GET /teacher/complaints/12/escalation': return { escalationId: null, emergencyReviewRequestId: current.requestId, escalationStatus: 'NOT_SHARED', riskReviewStatus: current.status, currentRiskScore: 70, currentRiskLevel: 'EMERGENCY', safetyLock: true };
    default: return undefined;
  }
}

test('교사 공유 내역의 링크를 누르면 메시지 목록에 없는 서버 민원 상세와 대화가 표시된다', async ({ page }) => {
  const sharedPage: TeacherEscalationPageResponse = {
    content: [{
      escalationId: 100, complaintId: 12, complaintTitle: '긴급 문의', studentName: '학생',
      assignedAdminName: '지정 관리자', reason: '학교 공동 검토가 필요합니다.', sharedScopes: ['MASKING_MESSAGES'],
      escalationStatus: 'UNDER_REVIEW', currentRiskScore: 70, currentRiskLevel: 'EMERGENCY',
      emergencyReviewRequestId: null, riskReviewStatus: null, safetyLock: true,
      sharedAt: '2026-10-30T10:00:00', reviewStartedAt: '2026-10-30T11:00:00', completedAt: null,
    }],
    page: 0, size: 10, totalElements: 1, totalPages: 1,
    first: true, last: true, hasNext: false, hasPrevious: false,
  };
  await setup(page, 'TEACHER', async (route, key) => {
    if (key === 'GET /teacher/escalations') {
      const status = new URL(route.request().url()).searchParams.get('status');
      const result = status && status !== 'UNDER_REVIEW'
        ? { ...sharedPage, content: [], totalElements: 0, totalPages: 0 }
        : sharedPage;
      await route.fulfill({ json: result });
      return true;
    }
    if (key === 'GET /teacher/complaints') {
      await route.fulfill({ json: { content: [], page: 0, size: 10, totalElements: 0, totalPages: 0, hasNext: false } });
      return true;
    }
    const json = teacherComplaintJson(key, review);
    if (json === undefined) return false;
    await route.fulfill({ json });
    return true;
  });

  await page.goto('/teacher/admin-share');
  const list = page.getByRole('region', { name: '관리자에게 공유한 메시지 목록', exact: true });
  await list.getByRole('link', { name: /^긴급 문의/ }).click();
  await expect(page).toHaveURL(/\/teacher\/messages\/12$/);
  await expect(page.getByRole('heading', { name: '메시지 상세', exact: true })).toBeVisible();
  await expect(page.getByRole('main').getByText('긴급 문의', { exact: true })).toBeVisible();
  await expect(page.getByRole('article').getByText('문의 요약', { exact: true })).toBeVisible();
});

test('교사 답변을 전송하면 ANSWERED로 표시하고 미처리 목록을 다시 조회한다', async ({ page }) => {
  const replyContent = '학교 일정을 확인해 안내드리겠습니다.';
  const initialMessage = { messageId: 1, senderRole: 'PARENT', senderName: '학부모', content: '일정 문의입니다.',
    sentAt: '2026-10-30T09:00:00', summarized: false };
  const reply = { messageId: 55, senderRole: 'TEACHER', senderName: '선생님', content: replyContent,
    sentAt: '2026-10-30T10:00:00', summarized: false };
  let answered = false;
  let openRequestsAfterReply = 0;
  const state = () => answered ? { status: 'ANSWERED', waitingFor: 'PARENT' } : { status: 'OPEN', waitingFor: 'TEACHER' };
  await setup(page, 'TEACHER', async (route, key) => {
    let json = teacherComplaintJson(key, review);
    switch (key) {
      case 'GET /teacher/complaints': {
        const status = new URL(route.request().url()).searchParams.get('status');
        if (answered && status === 'OPEN') openRequestsAfterReply += 1;
        const content = !status || status === state().status ? [{ complaintId: 12, title: '일정 문의', studentName: '학생',
          counterpartName: '학부모', ...state(), riskLevel: 'LOW', latestReceivedAt: initialMessage.sentAt }] : [];
        json = { content, page: 0, size: 10, totalElements: content.length, totalPages: content.length, hasNext: false };
        break;
      }
      case 'GET /teacher/complaints/12': json = { ...json as object, title: '일정 문의', ...state(), riskLevel: 'LOW' }; break;
      case 'GET /teacher/complaints/12/messages': json = { complaintId: 12, allowedActions: [], messages: answered ? [initialMessage, reply] : [initialMessage] }; break;
      case 'GET /teacher/complaints/12/risk': json = { ...json as object, riskScore: 10, riskLevel: 'LOW', currentRiskScore: 10, currentRiskLevel: 'LOW', safetyLock: false }; break;
      case 'GET /teacher/complaints/12/response-draft':
        await route.fulfill({ status: 404, json: { code: 'RESPONSE_DRAFT_NOT_FOUND' } });
        return true;
      case 'POST /teacher/complaints/12/response/ai-draft':
        json = { complaintId: 12, content: '생성된 초안입니다.', modelName: 'test', generatedAt: reply.sentAt };
        break;
      case 'POST /teacher/complaints/12/responses':
        expect(route.request().postDataJSON()).toEqual({ content: replyContent });
        answered = true;
        json = { responseId: 55, complaintId: 12, content: replyContent, complaintStatus: 'ANSWERED', waitingFor: 'PARENT', sentAt: reply.sentAt };
        break;
      default: break;
    }
    if (json === undefined) return false;
    await route.fulfill({ json });
    return true;
  });
  await page.goto('/teacher/messages/12/response');
  await page.getByRole('tab', { name: '직접 작성', exact: true }).click();
  await page.getByLabel('선생님 답변', { exact: true }).fill(replyContent);
  await page.getByRole('button', { name: '검토 후 전송', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: '답변 전 확인', exact: true });
  await confirm.getByRole('checkbox').check();
  await confirm.getByRole('button', { name: '최종 전송', exact: true }).click();
  await page.getByRole('dialog', { name: '답변 전송 완료', exact: true }).getByRole('button', { name: '확인', exact: true }).click();
  await expect(page.getByText(replyContent, { exact: true })).toBeVisible();
  await expect(page.getByText(/학부모의 답장을 기다리는 중/)).toBeVisible();
  await expect(page.getByRole('button', { name: /상담 완료 처리|상담 완료됨/ })).toHaveCount(0);
  await expect.poll(() => openRequestsAfterReply).toBeGreaterThan(1);
  await page.getByRole('button', { name: '목록으로 돌아가기', exact: true }).click();
  await expect(page.locator('.board-thread-row').filter({ hasText: '일정 문의' })).toHaveCount(0);
  await page.getByRole('button', { name: '상담 상태 필터', exact: true }).click();
  await page.getByRole('option', { name: '전체 상담', exact: true }).click();
  await expect(page.locator('.board-thread-row').filter({ hasText: '일정 문의' })).toContainText('답변 완료');
});

for (const canCreateEvidence of [true, false]) {
  test(`공유 창의 증빙 ${canCreateEvidence ? '선택 첨부' : '생성 불가'}와 공유 실패 재시도는 선택한 HTTP scope를 유지한다`, async ({ page }) => {
    let shared = false;
    const submissions: unknown[] = [];
    let completeShare: () => void = () => {};
    const shareGate = new Promise<void>((resolve) => { completeShare = resolve; });
    await setup(page, 'TEACHER', async (route, key) => {
      if (key === 'POST /teacher/complaints/12/escalation') {
        submissions.push(route.request().postDataJSON());
        if (submissions.length === 1) await route.fulfill({ status: 503, json: { message: '일시적인 공유 오류' } });
        else {
          await shareGate;
          shared = true;
          await route.fulfill({ json: 'shared' });
        }
        return true;
      }
      if (key === 'GET /teacher/complaints/12/emergency-review/current') {
        await route.fulfill({ status: 404, json: { code: 'EMERGENCY_REVIEW_NOT_FOUND' } }); return true;
      }
      let json = teacherComplaintJson(key, review);
      if (json === undefined) return false;
      if (key === 'GET /teacher/complaints/12/messages') json = { ...json as object, allowedActions: canCreateEvidence ? ['CREATE_EVIDENCE_PACKAGE'] : [] };
      if (key === 'GET /teacher/complaints/12/escalation') json = {
        ...json as object, escalationId: shared ? 3 : null, escalationStatus: shared ? 'SHARED' : 'NOT_SHARED',
        emergencyReviewRequestId: null, riskReviewStatus: null,
      };
      await route.fulfill({ json }); return true;
    });
    await page.goto('/teacher/messages/12');
    await page.getByRole('navigation', { name: '메시지 상세 탭' }).getByRole('button', { name: '위험 요소', exact: true }).click();
    const shareSection = page.getByRole('region', { name: '관리자 공유' });
    await shareSection.getByRole('button', { name: '관리자에게 공유', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '관리자에게 공유할까요?' });
    const prepare = dialog.getByRole('button', { name: '증빙 패키지 생성 후 첨부', exact: true });
    await dialog.getByLabel('공유 사유').fill('학교 공동 검토가 필요합니다.');
    if (canCreateEvidence) {
      await prepare.click();
      await expect(dialog.getByRole('checkbox', { name: '증빙 패키지', exact: true })).toBeChecked();
    } else {
      await expect(prepare).toBeDisabled();
      await expect(dialog).toContainText('현재 이 메시지의 증빙 패키지를 생성할 수 없습니다.');
    }
    await dialog.getByRole('button', { name: '공유하기', exact: true }).click();
    await expect(dialog.getByRole('alert')).toBeVisible();
    await expect(dialog.getByLabel('공유 사유')).toHaveValue('학교 공동 검토가 필요합니다.');
    if (canCreateEvidence) await expect(dialog.getByRole('checkbox', { name: '증빙 패키지', exact: true })).toBeChecked();
    await dialog.getByRole('button', { name: '공유하기', exact: true }).click();
    await expect(dialog.getByLabel('공유 사유')).toBeDisabled();
    await expect(dialog.getByRole('checkbox', { name: '원문 메시지', exact: true })).toBeDisabled();
    if (canCreateEvidence) await expect(dialog.getByRole('checkbox', { name: '증빙 패키지', exact: true })).toBeDisabled();
    completeShare();
    await expect(dialog).toHaveCount(0);
    const expected = { adminId: null, reason: '학교 공동 검토가 필요합니다.', scopes: canCreateEvidence ? ['MASKING_MESSAGES', 'MEDIATION_PACKAGE'] : ['MASKING_MESSAGES'] };
    expect(submissions).toEqual([expected, expected]);
    await expect(shareSection.getByRole('button', { name: '공유 완료', exact: true })).toBeDisabled();
  });
}

for (const riskLevel of ['LOW', 'MEDIUM'] as const) {
  test(`교사 ${riskLevel} 민원은 summaryStatus null의 원문을 대화와 답변 작성에 표시한다`, async ({ page }) => {
    const original = '상담 가능한 시간을 알려주세요.';
    await setup(page, 'TEACHER', async (route, key) => {
      let json = teacherComplaintJson(key, review);
      switch (key) {
        case 'GET /teacher/complaints/12': json = { ...json as object, riskLevel }; break;
        case 'GET /teacher/complaints/12/risk': json = {
          ...json as object, riskLevel, currentRiskLevel: riskLevel, safetyLock: false,
        }; break;
        case 'GET /teacher/complaints/12/messages': json = {
          complaintId: 12, allowedActions: [], messages: [
            { messageId: 'message:1', senderRole: 'PARENT', senderName: '학부모', content: '처음 문의입니다.',
              sentAt: '2026-10-30T09:00:00', summarized: false, summaryStatus: null },
            { messageId: 'message:2', senderRole: 'TEACHER', senderName: '선생님', content: '확인하고 있습니다.',
              sentAt: '2026-10-30T10:00:00', summarized: false, summaryStatus: null },
            { messageId: 'message:3', senderRole: 'PARENT', senderName: '학부모', content: original,
              sentAt: '2026-10-30T11:00:00', summarized: true, summaryStatus: null },
          ],
        }; break;
        case 'GET /teacher/complaints/12/response-draft':
          await route.fulfill({ status: 404, json: { code: 'RESPONSE_DRAFT_NOT_FOUND' } }); return true;
        case 'POST /teacher/complaints/12/response/ai-draft':
          json = { complaintId: 12, content: '생성된 초안입니다.', modelName: 'test', generatedAt: '2026-10-30T11:01:00' }; break;
        default: break;
      }
      if (json === undefined) return false;
      await route.fulfill({ json }); return true;
    });
    await page.goto('/teacher/messages/12');
    await expect(page.locator('.board-reply-parent').getByText(original, { exact: true })).toBeVisible();
    await expect(page.locator('.board-reply-teacher').getByText('확인하고 있습니다.', { exact: true })).toBeVisible();
    await expect(page.locator('.board-moderation-card')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '원문 보기', exact: true })).toHaveCount(0);
    await expect(page.getByText('AI 요약을 준비하고 있습니다.', { exact: true })).toHaveCount(0);
    await expect(page.locator('.board-info-box')).not.toContainText('완충 요약');

    await page.getByRole('button', { name: /답변 (작성하러 가기|이어서 작성하기)/ }).click();
    const context = page.locator('.board-reply-context-panel');
    await expect(context.getByRole('heading', { name: '학부모 메시지', exact: true })).toBeVisible();
    await expect(context).toContainText(original);
    await expect(context.getByRole('button', { name: '원문 보기', exact: true })).toHaveCount(0);
  });
}

test('교사 대화는 메시지별 summaryStatus로 분기하고 요약 카드에서만 원문을 요청한다', async ({ page }) => {
  const generated = '가정과 학교의 상담 일정에 관한 요약입니다.';
  const unavailable = '완충 요약을 생성하지 못했습니다. 원문 열람 버튼을 사용해주세요.';
  const originalViews: number[] = [];
  await setup(page, 'TEACHER', async (route, key) => {
    const requestForOriginal = /^POST \/teacher\/complaints\/12\/messages\/(\d+)\/original-views$/.exec(key);
    if (requestForOriginal) {
      const messageId = Number(requestForOriginal[1]);
      originalViews.push(messageId);
      await route.fulfill({ json: { complaintId: 12, messageId, content: `열람 승인된 원문 ${messageId}`,
        viewedAt: '2026-10-30T11:00:00' } });
      return true;
    }
    let json = teacherComplaintJson(key, review);
    if (key === 'GET /teacher/complaints/12/emergency-review/current') json = review;
    if (key === 'GET /teacher/complaints/12/messages') json = {
      complaintId: 12, allowedActions: [], messages: [
        { messageId: 'message:1', senderRole: 'PARENT', senderName: '학부모', content: generated,
          sentAt: '2026-10-30T09:00:00', summarized: false, summaryStatus: 'GENERATED' },
        { messageId: 'message:2', senderRole: 'PARENT', senderName: '학부모', content: '요약 미적용 문의 원문',
          sentAt: '2026-10-30T09:05:00', summarized: false, summaryStatus: null },
        { messageId: 'message:3', senderRole: 'PARENT', senderName: '학부모', content: unavailable,
          sentAt: '2026-10-30T09:10:00', summarized: false, summaryStatus: 'UNAVAILABLE' },
      ],
    };
    if (json === undefined) return false;
    await route.fulfill({ json }); return true;
  });
  await page.goto('/teacher/messages/12');
  const generatedCard = page.locator('.board-moderation-card').filter({ hasText: generated });
  const unavailableCard = page.locator('.board-moderation-card').filter({ hasText: unavailable });
  await expect(generatedCard).toContainText('위험 메시지 완충 요약');
  await expect(unavailableCard).toContainText('완충 요약을 확인할 수 없습니다');
  await expect(unavailableCard).not.toContainText('위험 메시지 완충 요약');
  await expect(unavailableCard.locator('.board-moderation-title svg')).toHaveCount(0);
  await expect(page.locator('.board-reply-parent')).toContainText('요약 미적용 문의 원문');
  expect(originalViews).toEqual([]);

  for (const [card, messageId] of [[generatedCard, 1], [unavailableCard, 3]] as const) {
    await card.getByRole('button', { name: '원문 보기', exact: true }).click();
    expect(originalViews).not.toContain(messageId);
    await page.getByRole('dialog', { name: '원문 열람 안내' }).getByRole('button', { name: '원문 확인', exact: true }).click();
    await expect(page.getByText(`열람 승인된 원문 ${messageId}`, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '이전 화면으로 돌아가기', exact: true }).click();
  }
  expect(originalViews).toEqual([1, 3]);
});

test('완충 요약 실패 응답은 원문 말풍선 대신 명시적인 요약 실패 안내를 표시한다', async ({ page }) => {
  await setup(page, 'TEACHER', async (route, key) => {
    let json = teacherComplaintJson(key, review);
    if (key === 'GET /teacher/complaints/12/emergency-review/current') json = review;
    if (key === 'GET /teacher/complaints/12/messages') json = {
      complaintId: 12, allowedActions: [], messages: [{
        messageId: 'message:1', senderRole: 'PARENT', senderName: '학부모',
        content: '실패한 요약에 섞인 원문은 표시하지 않습니다.', sentAt: '2026-10-30T09:00:00',
        summarized: false, summaryStatus: 'UNAVAILABLE', status: 'SENT', readAt: null,
      }],
    };
    if (json === undefined) return false;
    await route.fulfill({ json }); return true;
  });
  await page.goto('/teacher/messages/12');
  await expect(page.locator('.board-moderation-card')).toContainText('완충 요약을 확인할 수 없습니다');
  await expect(page.getByText('실패한 요약에 섞인 원문은 표시하지 않습니다.', { exact: true })).toHaveCount(0);
  await expect(page.locator('.board-answer-box')).toHaveClass(/is-locked/);
});

test('학부모가 읽은 서버 답변의 1을 숨기고 새 답변의 미열람 표시는 유지한다', async ({ page }) => {
  let latestReadAt: string | null = null;
  await setup(page, 'TEACHER', async (route, key) => {
    let json = teacherComplaintJson(key, review);
    if (key === 'GET /teacher/complaints/12/emergency-review/current') json = review;
    if (key === 'GET /teacher/complaints/12/messages') json = {
      complaintId: 12, allowedActions: [], messages: [
        { messageId: 'message:1', senderRole: 'PARENT', senderName: '학부모', content: '문의 요약', sentAt: '2026-10-30T09:00:00', summarized: true },
        { messageId: 'message:2', senderRole: 'TEACHER', senderName: '선생님', content: '이미 읽은 답변입니다.', sentAt: '2026-10-30T10:00:00', summarized: false, status: 'READ', readAt: '2026-10-30T10:05:00' },
        { messageId: 'message:3', senderRole: 'TEACHER', senderName: '선생님', content: '새로 보낸 답변입니다.', sentAt: '2026-10-30T11:00:00', summarized: false, status: 'SENT', readAt: latestReadAt },
      ],
    };
    if (json === undefined) return false;
    await route.fulfill({ json }); return true;
  });
  await page.goto('/teacher/messages/12');
  const earlier = page.locator('.board-reply-teacher').filter({ hasText: '이미 읽은 답변입니다.' });
  const latest = page.locator('.board-reply-teacher').filter({ hasText: '새로 보낸 답변입니다.' });
  await expect(earlier.locator('time')).toBeVisible();
  await expect(earlier.locator('.board-reply-unread')).toHaveCount(0);
  await expect(latest.locator('.board-reply-unread')).toHaveCount(1);
  latestReadAt = '2026-10-30T11:05:00';
  await page.reload();
  await expect(latest.locator('time')).toBeVisible();
  await expect(latest.locator('.board-reply-unread')).toHaveCount(0);
});

test('서버 메시지에서 공식 절차를 보고 돌아와도 위험 요소 탭과 잠금을 유지한다', async ({ page }) => {
  await setup(page, 'TEACHER', async (route, key) => {
    const json = key === 'GET /teacher/complaints/12/emergency-review/current'
      ? review : teacherComplaintJson(key, review);
    if (json === undefined) return false;
    await route.fulfill({ json }); return true;
  });
  await page.goto('/teacher/messages/12');
  const riskTab = page.getByRole('navigation', { name: '메시지 상세 탭' }).getByRole('button', { name: '위험 요소', exact: true });
  await riskTab.click();
  await page.getByRole('button', { name: '공식 절차 보기', exact: true }).click();
  await expect(page).toHaveURL(/\/teacher\/guide\?post=guide-emergency-official-procedure$/);
  await page.getByRole('button', { name: '이전 화면으로 돌아가기', exact: true }).click();
  await expect(page).toHaveURL(/\/teacher\/messages\/12$/);
  await expect(riskTab).toHaveClass(/is-active/);
  await expect(page.locator('.board-risk-lock-review')).toHaveCount(0);
});

test('사용자 조회 5xx는 저장된 JWT로 우회하지 않고 재시도를 제공한다', async ({ page }) => {
  await setup(page, 'ADMIN', async () => false);
  await page.evaluate(() => {
    const key = 'teacher-hub.auth-session';
    const session = JSON.parse(localStorage.getItem(key)!);
    const encode = (value: unknown) => btoa(JSON.stringify(value)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
    const claims = { sub: String(session.user.userId), email: session.user.email, role: session.user.role, exp: Math.floor(Date.now() / 1000) + 3600 };
    session.accessToken = `${encode({ alg: 'HS384' })}.${encode(claims)}.signature`;
    localStorage.setItem(key, JSON.stringify(session));
  });
  let failMe = true;
  await page.route((url) => url.pathname === '/api/users/me', (route) => failMe
    ? route.fulfill({ status: 503, json: { code: 'INTERNAL_SERVER_ERROR' } }) : route.fallback());
  await page.reload();
  await expect(page.getByRole('alert')).toBeVisible();
  const retry = page.getByRole('button', { name: '다시 시도', exact: true });
  await expect(retry).toBeVisible();
  failMe = false;
  await retry.click();
  await expect(page.getByRole('heading', { name: '공유받은 메시지', exact: true })).toBeVisible();
});

test('긴급 재검토 조회 실패는 일반 검토를 막지 않고 긴급 하향 요청만 막는다', async ({ page }) => {
  const current = { ...review, status: 'REJECTED', decidedAt: '2026-10-30T11:00:00' as string | null };
  await setup(page, 'TEACHER', async (route, key) => {
    if (key === 'GET /teacher/complaints/12/emergency-review/current') {
      await route.fulfill({ status: 503, json: { message: '조회 지연' } }); return true;
    }
    const json = teacherComplaintJson(key, current);
    if (json === undefined) return false;
    await route.fulfill({ json }); return true;
  });
  await page.goto('/teacher/messages/12');
  await page.getByRole('navigation', { name: '메시지 상세 탭' }).getByRole('button', { name: '위험 요소', exact: true }).click();
  await page.getByRole('button', { name: '최근 긴급 재검토 요청 상세', exact: true }).click();
  const reviewDetails = page.locator('.board-risk-workflow-accordion');
  await expect(reviewDetails.getByRole('alert')).toBeVisible();
  await expect(reviewDetails.getByText('관리자 검토 결과', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '검토 완료', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '5점 위험', exact: true }).click();
  await page.getByPlaceholder('하향 수정 사유를 입력해주세요.').fill('추가 근거를 확인했습니다.');
  await expect(page.getByRole('button', { name: '재검토 요청', exact: true })).toBeDisabled();
  await expect(page.getByText('현재 재검토 상태를 확인하지 못했습니다.', { exact: false })).toBeVisible();
});

test('서버 요약보다 오래된 관리자 요청 상세를 완료 결과로 표시하지 않는다', async ({ page }) => {
  const current = { ...review, requestId: 10, status: 'APPLIED', decidedAt: '2026-10-30T12:00:00' };
  await setup(page, 'TEACHER', async (route, key) => {
    const json = key === 'GET /teacher/complaints/12/emergency-review/current'
      ? { ...current, requestId: 9, requestedRiskLevel: 'LOW' } : teacherComplaintJson(key, current);
    if (json === undefined) return false;
    await route.fulfill({ json }); return true;
  });
  await page.goto('/teacher/messages/12');
  await page.getByRole('navigation', { name: '메시지 상세 탭' }).getByRole('button', { name: '위험 요소', exact: true }).click();
  await page.getByRole('button', { name: '최근 긴급 재검토 요청 상세', exact: true }).click();
  const reviewDetails = page.locator('.board-risk-workflow-accordion');
  await expect(reviewDetails).toContainText('최신 재검토 정보가 일치하지 않아 결과를 표시할 수 없습니다.');
  await expect(reviewDetails.getByText('관리자 검토 위험도', { exact: true })).toHaveCount(0);
  await expect(reviewDetails.getByText('지정 검토자', { exact: true })).toHaveCount(0);
});

test('최신 거부 요청의 잠금이 유지되어도 교사가 재요청하며 승인 대기 중에는 중복을 막는다', async ({ page }, testInfo) => {
  let current = { ...review, status: 'REJECTED', decidedAt: '2026-10-30T11:00:00' as string | null };
  const calls: string[] = [];
  await setup(page, 'TEACHER', async (route, key) => {
    calls.push(key);
    let json = teacherComplaintJson(key, current);
    switch (key) {
      case 'GET /teacher/complaints/12/emergency-review/current': json = current; break;
      case 'POST /teacher/complaints/12/emergency-review':
        expect(route.request().postDataJSON()).toEqual({ reason: '추가 근거를 확인했습니다.', riskScore: 5 });
        current = { ...current, requestId: 10, status: 'PENDING_ADMIN_APPROVAL', decidedAt: null };
        json = current; break;
      default: if (json === undefined) return false;
    }
    await route.fulfill({ json }); return true;
  });
  await page.goto('/teacher/messages/12');
  await page.getByRole('navigation', { name: '메시지 상세 탭' }).getByRole('button', { name: '위험 요소', exact: true }).click();
  const reviewDetails = page.getByRole('button', { name: '최근 긴급 재검토 요청 상세', exact: true });
  await expect(reviewDetails).toHaveAttribute('aria-expanded', 'false');
  await expect(reviewDetails.locator('path')).toHaveAttribute('d', 'm2 2 6 6 6-6');
  await reviewDetails.focus();
  await page.keyboard.press('Enter');
  await expect(reviewDetails).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.board-risk-workflow-accordion').getByText('지정 관리자', { exact: true })).toBeVisible();
  await page.locator('.board-risk-workflow-accordion').screenshot({ path: testInfo.outputPath('emergency-review-expanded.png'), animations: 'disabled' });
  await page.keyboard.press('Space');
  await expect(reviewDetails).toHaveAttribute('aria-expanded', 'false');
  await page.locator('.board-risk-workflow-accordion').screenshot({ path: testInfo.outputPath('emergency-review-collapsed.png'), animations: 'disabled' });
  await expect(page.locator('.board-risk-lock-review')).toHaveCount(0);
  await reviewDetails.click();
  await page.getByRole('button', { name: '5점 위험', exact: true }).click();
  await page.getByPlaceholder('하향 수정 사유를 입력해주세요.').fill('추가 근거를 확인했습니다.');
  await page.getByRole('button', { name: '재검토 요청', exact: true }).click();
  await expect(page.getByRole('region', { name: '관리자 공유' }).getByText('관리자 승인 대기', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '검토자 확인 대기', exact: true })).toBeDisabled();
  expect(calls).toContain('POST /teacher/complaints/12/emergency-review');
  expect(calls).not.toContain('POST /teacher/complaints/12/risk-reviews');
  await expect(page.locator('.board-risk-lock-review')).toHaveCount(0);
});

test('하나의 실제 재검토 요청은 실패 후 재시도하고 서버의 대기·승인·잠금 상태를 따른다', async ({ page }, testInfo) => {
  let current = { ...review, status: 'REJECTED', decidedAt: '2026-10-30T11:00:00' as string | null };
  let writes = 0;
  let completeSave: () => void = () => {};
  const saveGate = new Promise<void>((resolve) => { completeSave = resolve; });
  await setup(page, 'TEACHER', async (route, key) => {
    if (key === 'POST /teacher/complaints/12/emergency-review') {
      writes += 1;
      expect(route.request().postDataJSON()).toEqual({ reason: '추가 근거를 확인했습니다.', riskScore: 5 });
      if (writes === 1) await route.fulfill({ status: 503, json: { message: '저장 지연' } });
      else {
        await saveGate;
        current = { ...current, requestId: 10, status: 'PENDING_ADMIN_APPROVAL', decidedAt: null };
        await route.fulfill({ json: current });
      }
      return true;
    }
    if (key === 'GET /teacher/complaints/12/emergency-review/current') {
      await route.fulfill({ json: current }); return true;
    }
    let json = teacherComplaintJson(key, current);
    if (json === undefined) return false;
    if (current.status === 'APPLIED') {
      if (key === 'GET /teacher/complaints/12') json = { ...json as object, riskLevel: 'HIGH' };
      if (key === 'GET /teacher/complaints/12/risk' || key === 'GET /teacher/complaints/12/escalation') {
        json = { ...json as object, currentRiskLevel: 'HIGH', currentRiskScore: 50, reviewScale: 5, reviewScore: 50, reviewLevel: 'HIGH', safetyLock: current.safetyLock };
      }
    }
    await route.fulfill({ json }); return true;
  });
  await page.goto('/teacher/messages/12');
  const riskTab = page.getByRole('navigation', { name: '메시지 상세 탭' }).getByRole('button', { name: '위험 요소', exact: true });
  await riskTab.click();
  await expect(page.locator('.board-risk-recheck-button')).toHaveCount(0);
  await page.getByRole('button', { name: '5점 위험', exact: true }).click();
  const request = page.getByRole('button', { name: '재검토 요청', exact: true });
  await expect(request).toHaveCount(1);
  await expect(request).toBeDisabled();
  await page.getByPlaceholder('하향 수정 사유를 입력해주세요.').fill('추가 근거를 확인했습니다.');
  await request.click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(request).toBeEnabled();
  await expect(page.getByPlaceholder('하향 수정 사유를 입력해주세요.')).toHaveValue('추가 근거를 확인했습니다.');
  await expect(page.getByRole('button', { name: '검토자 확인 대기', exact: true })).toHaveCount(0);
  await request.evaluate((button) => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
  await expect.poll(() => writes).toBe(2);
  await expect(page.getByRole('button', { name: '저장 중…', exact: true })).toBeDisabled();
  completeSave();
  await expect(page.getByRole('button', { name: '검토자 확인 대기', exact: true })).toBeDisabled();
  await expect(page.locator('.board-risk-lock-review')).toHaveCount(0);
  await page.locator('.board-risk-review-panel').screenshot({ path: testInfo.outputPath('server-review-pending.png') });
  await page.reload();
  await riskTab.click();
  await expect(page.getByRole('button', { name: '검토자 확인 대기', exact: true })).toBeDisabled();
  // Even an approved response must explicitly report the release before the UI removes the lock.
  current = { ...current, status: 'APPLIED', safetyLock: true, decidedAt: '2026-10-30T12:00:00' };
  await page.reload();
  await riskTab.click();
  await expect(page.getByRole('button', { name: '검토자 확인 대기', exact: true })).toHaveCount(0);
  await expect(page.locator('.board-risk-lock-review')).toHaveCount(0);
  await page.getByRole('navigation', { name: '메시지 상세 탭' }).getByRole('button', { name: '대화', exact: true }).click();
  await expect(page.locator('.board-answer-box')).toHaveClass(/is-locked/);
  await expect(page.locator('.board-answer-box')).toContainText('안전 잠금이 유지되는 동안 답변 생성과 전송이 제한돼요.');
  current = { ...current, safetyLock: false };
  await page.reload();
  await riskTab.click();
  await expect(page.locator('.board-risk-lock-review')).toHaveCount(0);
  await page.getByRole('navigation', { name: '메시지 상세 탭' }).getByRole('button', { name: '대화', exact: true }).click();
  await expect(page.locator('.board-answer-box')).not.toHaveClass(/is-locked/);
  expect(writes).toBe(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
