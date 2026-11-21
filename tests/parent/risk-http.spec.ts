import { expect, test, type Page } from '@playwright/test';
import type { ParentConversationResponse, RiskDetectorResponse, RiskSummaryResponse, SubmissionAnalysisResponse } from '../../src/features/parent-message/api/parentComplaintTypes';

const body = '상담 시간을 알려 주세요. 010-1234-5678';
const maskedContent = '상담 시간을 알려 주세요. [전화번호]';
const detector = {
  analysisId: 7,
  results: [{ code: 'THREAT', finalState: 'BOUNDARY',
    rule: { state: 'ABSENT', confidence: 0, evidenceSpans: [] },
    llm: { state: 'BOUNDARY', confidence: 0.65, evidenceSpans: [{ text: '상담 시간을 알려 주세요.', start: 0, end: 14 }] },
  }],
  llm: { modelName: 'test-detector', temperature: 0.1 },
};
const thread = {
  messageId: 'thread-local', serverComplaintId: 42, teacherId: '20', teacherName: 'Demo Teacher',
  title: '기존 서버 문의', originalBody: '기존 문의', finalBody: '기존 문의',
  selectionType: 'ORIGINAL', selectionSource: 'ORIGINAL', status: 'SENT',
  sentAt: '2026-10-29T10:00:00Z', auditLog: [], consultationStatus: 'inProgress',
};

async function setup(page: Page, options: {
  tagFailure?: boolean; finding?: boolean; followUp?: boolean; maskFailure?: boolean; detectorFailure?: boolean;
  conflict?: boolean; localOnly?: boolean; failFollowUpSendOnce?: boolean; changedBeforeSend?: boolean;
  summary?: Partial<RiskSummaryResponse>; detector?: RiskDetectorResponse; submission?: SubmissionAnalysisResponse;
  analysisErrorCode?: string; sendErrorCode?: string; noRevision?: boolean;
  lifecycle?: { status: 'ANSWERED' | 'CLOSED'; closeConflict?: boolean };
} = {}) {
  const calls: string[] = [];
  let content = maskedContent;
  let savedFollowUp = false;
  let sendAttempts = 0;
  let complaintStatus: ParentConversationResponse['status'] = options.lifecycle?.status ?? 'OPEN';
  let followUpSentAt: string | null = null;
  // The server's contentVersion: it grows only when the content changes.
  let version = 1;
  const failDetector = options.detectorFailure;
  const versionConflict = { code: 'CONTENT_VERSION_CONFLICT', message: '추가 문의 초안이 다른 기기에서 변경되었습니다.' };
  const followUp = () => ({ messageId: 101, complaintId: 42, content, contentVersion: version, status: 'DRAFT', waitingFor: 'PARENT', createdAt: '2026-10-30T10:00:00', updatedAt: '2026-10-30T10:00:00', sentAt: null });
  const waitingFor = () => complaintStatus === 'CLOSED' ? 'NONE' : complaintStatus === 'ANSWERED' ? 'PARENT' : 'TEACHER';
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api', '');
    const key = `${request.method()} ${path}`;
    calls.push(key);
    let json: unknown;
    let status = 200;
    switch (key) {
      case 'GET /risk-tags': status = options.tagFailure ? 503 : 200; json = options.tagFailure ? { code: 'INTERNAL_SERVER_ERROR' } : [{ id: 1, code: 'THREAT', name: '서버에서 관리하는 협박 명칭', defaultScore: 30 }]; break;
      case 'GET /complaints': json = {
        content: options.lifecycle ? [{ complaintId: 42, title: thread.title, counterpartName: thread.teacherName,
          status: complaintStatus, waitingFor: waitingFor(), latestReceivedAt: followUpSentAt ?? thread.sentAt }] : [],
        hasNext: false, totalPages: 1,
      }; break;
      case 'GET /users/me': json = { userId: 101, email: 'parent@example.com', name: 'Demo Parent', role: 'PARENT', students: [{ studentId: 10, name: 'Demo Student', studentNo: '1' }] }; break;
      case 'GET /complaints/recipients': json = [{ teacherId: 20, teacherName: 'Demo Teacher', homeroomTeacher: true }]; break;
      case 'POST /complaints':
        expect(request.postDataJSON().content).not.toContain('010-1234-5678');
        content = request.postDataJSON().content;
        json = { complaintId: 42, status: 'DRAFT', waitingFor: 'NONE' }; break;
      case 'PATCH /complaints/42': content = request.postDataJSON().content; json = { message: '수정됨' }; break;
      case 'POST /complaints/42/mask':
        expect(request.postData()).toBeNull();
        status = options.maskFailure ? 500 : 200;
        json = options.maskFailure ? { code: 'INTERNAL_SERVER_ERROR' } : { complaintId: 42, contentVersion: 1, maskedContent: content }; break;
      case 'POST /complaints/42/risk-analysis':
      case 'POST /complaints/42/messages/101/risk-analysis':
        status = options.analysisErrorCode ? 500 : 200;
        json = options.analysisErrorCode ? { code: options.analysisErrorCode, message: 'Internal Java exception' }
          : { analysisId: options.followUp ? 8 : 7, complaintId: 42, riskScore: 30, riskLevel: 'HIGH', ...options.summary }; break;
      case 'GET /risk-analyses/7/findings':
      case 'GET /risk-analyses/8/findings': json = { findings: options.finding ? [{ code: 'THREAT', evidences: ['상담 시간을 알려 주세요.'], revisionSuggestions: [] }] : [], finalRevision: options.noRevision ? null : { content: '상담 가능한 시간을 안내해 주세요.', reason: '요청을 구체적이고 부드럽게 표현했습니다.' } }; break;
      case 'GET /risk-analyses/7/detector-results':
      case 'GET /risk-analyses/8/detector-results':
        status = failDetector ? 500 : 200;
        json = failDetector ? { code: 'INTERNAL_SERVER_ERROR' } : options.detector ?? detector;
        break;
      case 'GET /complaints/42/message-draft':
        status = savedFollowUp || options.conflict ? 200 : 404;
        json = options.conflict ? { ...followUp(), content: '다른 탭의 초안' } : savedFollowUp ? followUp() : { code: 'MESSAGE_DRAFT_NOT_FOUND' }; break;
      case 'PUT /complaints/42/message-draft': {
        const draft = request.postDataJSON();
        expect(draft.content).not.toContain('010-1234-5678');
        if (savedFollowUp ? draft.expectedContentVersion !== version : draft.expectedContentVersion !== undefined) {
          status = 409; json = versionConflict; break;
        }
        if (savedFollowUp && draft.content !== content) version += 1;
        content = draft.content;
        savedFollowUp = true;
        json = followUp(); break;
      }
      case 'POST /complaints/42/messages/101/send':
        if (options.changedBeforeSend) { content = '다른 기기에서 고친 내용'; version += 1; }
        if (request.postDataJSON().expectedContentVersion !== version) { status = 409; json = versionConflict; break; }
        sendAttempts += 1;
        status = options.sendErrorCode || (options.failFollowUpSendOnce && sendAttempts === 1) ? 500 : 200;
        if (status === 200) {
          complaintStatus = 'OPEN';
          followUpSentAt = '2026-10-30T10:03:00';
        }
        json = status === 500 ? { code: options.sendErrorCode ?? 'INTERNAL_SERVER_ERROR' }
          : { ...followUp(), status: 'SENT', waitingFor: 'TEACHER', sentAt: followUpSentAt, ...options.submission }; break;
      case 'GET /complaints/42/messages': {
        const messages: ParentConversationResponse['messages'] = options.lifecycle ? [
          { messageId: 1, type: 'PARENT_INQUIRY', senderRole: 'PARENT', senderName: 'Demo Parent', content: thread.finalBody,
            status: 'READ', sentAt: thread.sentAt, readAt: null },
          { messageId: 2, type: 'TEACHER_REPLY', senderRole: 'TEACHER', senderName: thread.teacherName, content: '확인한 답변입니다.',
            status: 'READ', sentAt: '2026-10-29T20:00:00Z', readAt: null },
        ] : [];
        if (options.lifecycle && followUpSentAt) messages.push({ messageId: 101, type: 'PARENT_INQUIRY', senderRole: 'PARENT',
          senderName: 'Demo Parent', content, status: 'SENT', sentAt: followUpSentAt, readAt: null });
        json = { complaintId: 42, status: complaintStatus, waitingFor: waitingFor(), messages };
        break;
      }
      case 'POST /complaints/42/close':
        expect(request.postData()).toBeNull();
        expect(complaintStatus).toBe('ANSWERED');
        complaintStatus = 'CLOSED';
        status = options.lifecycle?.closeConflict ? 409 : 200;
        json = status === 409 ? { code: 'COMPLAINT_NOT_CLOSABLE', message: '이미 종료된 민원입니다.' }
          : { complaintId: 42, status: complaintStatus, waitingFor: waitingFor() };
        break;
      case 'POST /complaints/42/send':
        status = options.sendErrorCode ? 500 : 200;
        json = options.sendErrorCode ? { code: options.sendErrorCode } : { message: '제출됨', ...options.submission }; break;
      default: throw new Error(`Unexpected request: ${key}`);
    }
    await route.fulfill({ status, json });
  });
  if (options.followUp || options.lifecycle) await page.addInitScript(({ initial, conflict }) => {
    localStorage.setItem('teacher-hub.parent-sent-messages.101', JSON.stringify([initial]));
    if (conflict) localStorage.setItem('teacher-hub.parent-message-draft.101', JSON.stringify({
      messageId: 'follow-up-local', teacherId: '20', title: initial.title, body: '내가 작성한 내용', status: 'DRAFT', threadId: initial.messageId,
      server: { complaintId: 42, serverMessageId: 101, teacherId: 20, teacherName: 'Demo Teacher', title: initial.title, content: '이전에 저장한 내용', analysisId: null },
    }));
  }, { initial: { ...thread, serverComplaintId: options.localOnly ? undefined : thread.serverComplaintId }, conflict: options.conflict });
  await page.goto('/login?role=PARENT');
  await page.locator('input[name="email"]').fill('parent@example.com');
  await page.locator('input[name="password"]').fill('password123');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page).toHaveURL(/\/parent\/messages\/new$/);
  if (options.lifecycle) await page.goto('/parent/messages/thread-local');
  else if (options.followUp) await page.goto('/parent/messages/thread-local/follow-up');
  else {
    await expect(page.getByLabel('문의 대상', { exact: true })).toBeEnabled();
    await page.getByLabel('문의 제목', { exact: true }).fill('HTTP 분석 확인');
  }
  return calls;
}

async function analyze(page: Page) {
  await page.getByLabel('문의 내용', { exact: true }).fill(body);
  await page.getByRole('button', { name: 'AI 분석 시작', exact: true }).click();
  await expect(page).toHaveURL(/\/review$/);
}

test('분석 후 작성 화면과 새로고침에서도 선택한 자녀 이름을 표시한다', async ({ page }) => {
  const calls = await setup(page);
  const child = page.getByLabel('자녀', { exact: true });
  await expect(child.locator('option:checked')).toHaveText('Demo Student');
  await analyze(page);
  await page.getByRole('button', { name: '문의 작성으로 돌아가기', exact: true }).click();
  await expect(child).toBeDisabled();
  await expect(child.locator('option:checked')).toHaveText('Demo Student');
  await page.reload();
  await expect(child.locator('option:checked')).toHaveText('Demo Student');
  await expect(child).toBeDisabled();
  expect(calls.filter((call) => call === 'POST /complaints')).toHaveLength(1);
});

test('이름 없이 저장된 초안도 조회 실패를 재시도해 학생 ID에 맞는 이름으로 복원한다', async ({ page }) => {
  await setup(page);
  let failChildren = true;
  await page.route((url) => url.pathname === '/api/users/me', (route) => failChildren
    ? route.fulfill({ status: 503, json: { code: 'INTERNAL_SERVER_ERROR' } })
    : route.fulfill({ json: { userId: 101, email: 'parent@example.com', name: '학부모', role: 'PARENT', students: [
      { studentId: 10, name: '김하나', studentNo: '1' }, { studentId: 11, name: '김두리', studentNo: '2' },
    ] } }));
  await page.evaluate(() => localStorage.setItem('teacher-hub.parent-message-draft.101', JSON.stringify({
    messageId: 'legacy-child-draft', teacherId: '20', title: '기존 초안', body: '작성한 문의입니다.', status: 'DRAFT',
    server: { complaintId: 42, studentId: 11, teacherId: 20, teacherName: 'Demo Teacher',
      title: '기존 초안', content: '작성한 문의입니다.', analysisId: null },
  })));
  await page.reload();
  const child = page.getByLabel('자녀', { exact: true });
  await expect(child).toBeDisabled();
  const retry = page.locator('#parent-message-studentId-helper').getByRole('button', { name: '다시 시도', exact: true });
  await expect(retry).toBeVisible();
  failChildren = false;
  await retry.click();
  await expect(child.locator('option:checked')).toHaveText('김두리');
  await expect(child).toHaveValue('11');
  await expect(child).toBeDisabled();
  await expect(page.getByLabel('문의 대상', { exact: true })).toBeDisabled();
  await expect(page.getByLabel('문의 제목', { exact: true })).toHaveAttribute('readonly', '');
});

test('비동기 수정안이 도착해도 원문에서 작성한 내용과 선택한 탭을 유지한다', async ({ page }) => {
  await setup(page);
  let revisionReady = false;
  await page.route((url) => url.pathname === '/api/risk-analyses/7/findings', (route) => route.fulfill({ json: {
    revisionStatus: revisionReady ? 'COMPLETED' : 'PENDING', findings: [],
    finalRevision: revisionReady ? { content: '늦게 준비된 AI 수정안입니다.', reason: '표현을 다듬었습니다.' } : null,
  } }));
  await analyze(page);
  await expect(page.getByText('AI 수정안을 준비하고 있습니다.', { exact: false })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'AI 초안', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '직접 수정', exact: true }).click();
  const original = page.getByLabel('직접 수정한 문의 내용', { exact: true });
  await original.fill('원문을 확인하며 직접 작성한 문장입니다.');
  revisionReady = true;
  await expect(page.getByRole('tab', { name: 'AI 초안', exact: true })).toBeEnabled({ timeout: 10_000 });
  await expect(page.getByRole('tab', { name: '원문', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(original).toHaveValue('원문을 확인하며 직접 작성한 문장입니다.');
  await page.getByRole('tab', { name: 'AI 초안', exact: true }).click();
  await expect(page.getByLabel('AI 초안 내용', { exact: true })).toHaveValue('늦게 준비된 AI 수정안입니다.');
});

for (const firstLookupFails of [false, true]) {
  test(`수정안 ${firstLookupFails ? '최초' : '대기 중'} 조회 실패는 같은 분석을 재조회하고 분석 요청을 추가로 보내지 않는다`, async ({ page }) => {
    const calls = await setup(page, { summary: { revisionStatus: 'PENDING' } });
    let findingsCalls = 0;
    let revisionReady = false;
    await page.route((url) => url.pathname === '/api/risk-analyses/7/findings', (route) => {
      findingsCalls += 1;
      if ((firstLookupFails || findingsCalls > 1) && !revisionReady) return route.fulfill({ status: 503, json: { code: 'INTERNAL_SERVER_ERROR' } });
      return route.fulfill({ json: {
        revisionStatus: revisionReady ? 'COMPLETED' : 'PENDING', findings: [],
        finalRevision: revisionReady ? { content: '재조회한 AI 수정안입니다.', reason: '확인됨' } : null,
      } });
    });
    await analyze(page);
    const retry = page.getByRole('button', { name: '수정안 다시 확인', exact: true });
    await expect(retry).toBeVisible();
    revisionReady = true;
    await retry.click();
    await expect(page.getByRole('tab', { name: 'AI 초안', exact: true })).toBeEnabled();
    expect(calls.filter((call) => call === 'POST /complaints/42/risk-analysis')).toHaveLength(1);
  });
}

test('서버 초안 생성 중 다시 연 작성 화면에서도 선생님 목록 오류를 재시도한다', async ({ page }) => {
  const calls = await setup(page);
  let releaseCreation!: () => void;
  const creationGate = new Promise<void>((resolve) => { releaseCreation = resolve; });
  await page.route((url) => url.pathname === '/api/complaints', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    await creationGate;
    await route.fallback();
  });
  try {
    await page.getByLabel('문의 내용', { exact: true }).fill(body);
    await Promise.all([
      page.waitForRequest((request) => request.method() === 'POST' && new URL(request.url()).pathname === '/api/complaints'),
      page.getByRole('button', { name: 'AI 분석 시작', exact: true }).click(),
    ]);
    let recipientAttempts = 0;
    let rejectRecipients = true;
    await page.route((url) => url.pathname === '/api/complaints/recipients', async (route) => {
      recipientAttempts += 1;
      if (rejectRecipients) await route.fulfill({ status: 503, json: { code: 'INTERNAL_SERVER_ERROR' } });
      else await route.fallback();
    });
    // SPA navigation remounts the composer without clearing its pending creation registry.
    await page.getByRole('navigation', { name: '현재 위치' }).getByRole('link', { name: '홈', exact: true }).click();
    await expect(page.getByLabel('문의 제목', { exact: true })).toHaveAttribute('readonly', '');
    await expect(page.getByLabel('문의 대상', { exact: true })).toBeDisabled();
    const helper = page.locator('#parent-message-teacherId-helper');
    await expect(helper).toBeVisible();
    const failedAttempts = recipientAttempts;
    rejectRecipients = false;
    await helper.getByRole('button', { name: '다시 시도', exact: true }).click();
    await expect.poll(() => recipientAttempts).toBeGreaterThan(failedAttempts);
    await expect(page.locator('#parent-message-teacherId option[value="20"]')).toHaveCount(1);
    await expect(page.getByLabel('문의 대상', { exact: true })).toBeDisabled();
    await expect(helper).toHaveCount(0);
    releaseCreation();
    await expect.poll(() => calls.filter((call) => call === 'POST /complaints').length).toBe(1);
    await expect.poll(() => page.evaluate(() => localStorage.getItem('teacher-hub.parent-message-draft.101'))).toContain('"complaintId":42');
    expect(calls).not.toContain('POST /complaints/42/send');
  } finally {
    releaseCreation();
  }
});

async function checkInformationTooltip(page: Page, label: string, content: string, touch: boolean, screenshotPath?: string) {
  const trigger = page.getByRole('button', { name: label, exact: true });
  const tooltip = page.getByRole('tooltip');
  await trigger.scrollIntoViewIfNeeded();
  await trigger.focus();
  await expect(tooltip).toHaveText(content);
  const box = (await tooltip.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  await page.keyboard.press('Escape');
  await expect(tooltip).toHaveCount(0);
  await expect(trigger).toBeFocused();
  if (touch) await trigger.tap();
  else {
    await page.mouse.move(0, 0);
    await trigger.hover();
  }
  await expect(tooltip).toHaveText(content);
  if (screenshotPath) await page.screenshot({ path: screenshotPath, animations: 'disabled' });
  const outside = page.getByRole('heading', { name: '새 문의 작성', exact: true });
  if (touch) await outside.tap();
  else await outside.click();
  await expect(tooltip).toHaveCount(0);
}

test('입력창 아래의 안내는 분석 전후에 유지되고 입력 잠금 조건을 보존한다', async ({ page }, testInfo) => {
  const calls = await setup(page);
  const notice = page.locator('#parent-message-analysis-description');
  const noticeText = 'AI 분석 후 내용을 확인하고 전송할 수 있어요. 분석 시작 후 자녀·문의 대상·제목은 변경할 수 없으며, 문의 내용은 계속 수정할 수 있습니다.';
  const analyzeButton = page.getByRole('button', { name: 'AI 분석 시작', exact: true });
  await expect(notice).toHaveText(noticeText);
  await expect(analyzeButton).toHaveAccessibleDescription(noticeText);
  await expect(page.getByText(noticeText, { exact: true })).toHaveCount(1);
  await expect(notice.locator('span').first()).toHaveText('AI 분석 후 내용을 확인하고 전송할 수 있어요.');
  await expect(notice.locator('.sr-only')).toHaveCSS('clip-path', 'inset(50%)');
  await expect(page.getByRole('button', { name: 'AI 분석 안내', exact: true })).toHaveCount(1);
  await expect(page.locator('.parent-write-notice')).not.toContainText('AI 분석');
  await expect(page.getByLabel('자녀', { exact: true })).toBeEnabled();
  await expect(page.getByLabel('문의 대상', { exact: true })).toBeEnabled();
  await expect(page.getByLabel('문의 제목', { exact: true })).toBeEditable();
  for (const name of ['자녀', '문의 대상']) {
    await expect(page.getByLabel(name, { exact: true }).locator('..')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  }
  await analyze(page);
  expect(calls).not.toContain('POST /complaints/42/send');
  await page.getByRole('button', { name: '문의 작성으로 돌아가기', exact: true }).click();
  await expect(notice).toHaveText(noticeText);
  await expect(page.getByText(noticeText, { exact: true })).toHaveCount(1);
  await expect(analyzeButton).toHaveAccessibleDescription(noticeText);
  await expect(page.locator('.parent-write-field .ui-field-message')).toHaveCount(0);
  for (const name of ['자녀', '문의 대상', '문의 제목']) {
    await expect(page.getByLabel(name, { exact: true })).toHaveAttribute('aria-describedby', 'parent-message-analysis-description');
  }
  await expect(page.getByLabel('자녀', { exact: true })).toBeDisabled();
  await expect(page.getByLabel('문의 대상', { exact: true })).toBeDisabled();
  for (const name of ['자녀', '문의 대상']) {
    await expect(page.getByLabel(name, { exact: true }).locator('..')).toHaveCSS('background-color', 'rgb(238, 240, 245)');
  }
  await expect(page.getByLabel('문의 제목', { exact: true })).toHaveAttribute('readonly', '');
  await expect(page.getByLabel('문의 내용', { exact: true })).toBeEditable();
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1100 });
    await page.getByRole('heading', { name: '새 문의 작성', exact: true }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    // Finish the shell's padding transition before measuring responsive geometry.
    await page.screenshot({ path: testInfo.outputPath(`parent-layout-${width}.png`), fullPage: true, animations: 'disabled' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect.poll(() => page.locator('.parent-write-footer').evaluate((element) => (
      element.getBoundingClientRect().top - document.querySelector('.parent-write-guidance')!.getBoundingClientRect().bottom
    ))).toBe(16);
    const layout = await notice.evaluate((element) => ({
      note: element.parentElement!.getBoundingClientRect().toJSON(),
      button: document.querySelector('.parent-write-analyze')!.getBoundingClientRect().toJSON(),
      save: document.querySelector('.parent-write-save')!.getBoundingClientRect().toJSON(),
    }));
    for (const button of [layout.save, layout.button]) {
      expect(button.height).toBeGreaterThanOrEqual(44);
      expect(button.height).toBeLessThanOrEqual(48);
    }
    expect(layout.note.bottom).toBeLessThanOrEqual(layout.button.top - 16);
    expect(layout.button.left - layout.save.right).toBeGreaterThanOrEqual(8);
    expect(layout.button.left - layout.save.right).toBeLessThanOrEqual(12);
    expect(layout.save.top).toBeCloseTo(layout.button.top, 0);
    expect(layout.save.bottom).toBeCloseTo(layout.button.bottom, 0);
    await checkInformationTooltip(page, 'AI 분석 안내', '분석 시작 후 자녀·문의 대상·제목은 변경할 수 없으며, 문의 내용은 계속 수정할 수 있습니다.',
      testInfo.project.name === 'mobile', [375, 1440].includes(width) ? testInfo.outputPath(`analysis-tooltip-${width}.png`) : undefined);
  }
  await page.locator('.parent-write-form').screenshot({ path: testInfo.outputPath('parent-locked-fields-desktop.png') });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath('parent-locked-fields-mobile.png'), fullPage: true });
});

test('추가 문의는 분석 여부 대신 기존 대상·제목을 유지하는 이유를 설명한다', async ({ page }) => {
  await setup(page, { followUp: true });
  await expect(page.locator('.parent-write-analysis-note')).toHaveText('추가 문의는 기존 문의의 대상과 제목을 그대로 사용합니다. 이어서 전달할 내용을 작성해 주세요.');
  await expect(page.locator('.parent-write-notice')).not.toContainText('AI 분석을 시작하면');
  await expect(page.getByLabel('문의 대상', { exact: true })).toHaveAttribute('readonly', '');
  await expect(page.getByLabel('문의 제목', { exact: true })).toHaveAttribute('readonly', '');
  await expect(page.getByLabel('문의 내용', { exact: true })).toBeEditable();
});

test('새 문의의 자녀·대상·제목·내용은 같은 시작선에 표시되고 작은 버튼으로 작성한다', async ({ page }, testInfo) => {
  await setup(page);
  const title = page.getByLabel('문의 제목', { exact: true });
  const privacy = page.getByRole('region', { name: '개인정보 마스킹 상태', exact: true });
  await title.fill('');
  await expect(privacy).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('parent-empty.png'), fullPage: true, animations: 'disabled' });
  await title.fill('HTTP 분석 확인');
  await expect(privacy).toContainText('개인정보를 확인해 주세요.');
  await expect(privacy).not.toContainText('없습니다.');
  await expect(privacy).not.toContainText('이름·주소');
  await expect(privacy).not.toHaveClass(/has-personal-info|is-failed/);
  await expect(privacy).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(privacy).toHaveCSS('border-top-width', '0px');
  await page.screenshot({ path: testInfo.outputPath('parent-privacy-neutral.png'), fullPage: true, animations: 'disabled' });
  await page.getByLabel('문의 내용', { exact: true }).fill(body);
  await expect(privacy).toHaveClass(/has-personal-info/);
  await expect(privacy).toContainText('1건 마스킹');
  await privacy.getByText('마스킹 결과 보기', { exact: true }).click();
  await expect(privacy.locator('.privacy-masking-preview p')).toBeVisible();
  await expect(privacy).not.toContainText('010-1234-5678');
  await privacy.getByText('마스킹 결과 보기', { exact: true }).click();
  await expect(page.getByLabel('자녀', { exact: true })).toBeEnabled();
  await expect(page.locator('.parent-write-field .ui-field-control')).toHaveCount(4);
  for (const width of [1440, 1240, 1024, 980, 820, 768, 620, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath(`parent-form-${width}.png`), fullPage: true, animations: 'disabled' });
    const starts = await page.locator('.parent-write-field .ui-field-control').evaluateAll((controls) => controls.map((control) => {
      const style = getComputedStyle(control);
      return control.getBoundingClientRect().left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft);
    }));
    expect(Math.max(...starts) - Math.min(...starts), `${width}px input text alignment`).toBeLessThanOrEqual(1);
    const geometry = await page.locator('.parent-write-form').evaluate((element) => ({
      fields: Array.from(element.querySelectorAll('.parent-write-field')).map((field) => ({
        label: field.querySelector('.ui-field-label')!.getBoundingClientRect().toJSON(),
        control: field.querySelector('.ui-field-control')!.getBoundingClientRect().toJSON(),
        shell: field.querySelector('.ui-input-shell, .ui-select-shell, .ui-textarea-control')!.getBoundingClientRect().toJSON(),
      })),
      body: element.querySelector('.parent-write-body')!.getBoundingClientRect().toJSON(),
      privacy: element.querySelector('.privacy-masking-notice')!.getBoundingClientRect().toJSON(),
      analyze: element.querySelector('.parent-write-analyze')!.getBoundingClientRect().toJSON(),
      form: element.getBoundingClientRect().toJSON(),
    }));
    for (const field of geometry.fields) {
      if (width > 820) {
        expect(field.label.width).toBeGreaterThanOrEqual(140);
        expect(field.label.width).toBeLessThanOrEqual(160);
        expect(field.shell.left - field.label.right).toBeCloseTo(24, 0);
      } else {
        expect(field.label.bottom).toBeLessThanOrEqual(field.control.top);
      }
    }
    for (const field of geometry.fields.slice(0, 3)) {
      if (width > 820) expect(field.label.y + field.label.height / 2).toBeCloseTo(field.control.y + field.control.height / 2, 0);
    }
    expect(geometry.fields[3].control.height).toBe(width > 820 ? 224 : 200);
    expect(geometry.privacy.top - geometry.body.bottom).toBe(16);
    expect(geometry.privacy.left).toBeCloseTo(geometry.body.left + (width > 820 ? (width > 1240 ? 160 : 140) + 24 : 0), 0);
    expect(geometry.analyze.right).toBeCloseTo(geometry.form.right, 0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if ([375, 768, 1024, 1440].includes(width)) {
      await checkInformationTooltip(page, '개인정보 확인 범위', '전화번호·이메일·주민등록번호를 자동으로 확인합니다. 이름·주소 등 다른 개인정보가 포함되어 있는지도 직접 확인해 주세요.',
        testInfo.project.name === 'mobile', [375, 1440].includes(width) ? testInfo.outputPath(`privacy-tooltip-${width}.png`) : undefined);
    }
  }
  await page.getByRole('heading', { name: '새 문의 작성', exact: true }).click();
  await page.locator('.parent-write-form').screenshot({ path: testInfo.outputPath('parent-form-mobile.png') });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.locator('.parent-write-form').screenshot({ path: testInfo.outputPath('parent-form-desktop.png') });
});

test('태그 명칭 응답이 지연되어도 검토 화면과 상세 탐지 결과를 먼저 표시한다', async ({ page }) => {
  await setup(page, { finding: true });
  await page.route((url) => url.pathname === '/api/risk-tags', () => new Promise<void>(() => {}));
  await analyze(page);
  await page.getByRole('tab', { name: '원문', exact: true }).click();
  const expand = page.getByRole('button', { name: '주의 표현 목록 펼치기', exact: true });
  if (await expand.count()) await expand.click();
  await expect(page.getByRole('region', { name: '탐지된 위험 표현 목록 (1)' }).getByText('위험·협박', { exact: true })).toBeVisible();
  const results = page.getByRole('region', { name: '위험 분석 결과' });
  await results.getByText('상세 탐지 결과 보기', { exact: true }).click();
  await expect(results.getByRole('button', { name: '위험·협박 경계', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '전송하기', exact: true })).toBeEnabled();
});

for (const tagFailure of [false, true]) {
  test(`태그 명칭 조회 ${tagFailure ? '실패 시 기본 이름으로 분석을 유지한다' : '성공 시 검토 화면에도 서버 이름을 표시한다'}`, async ({ page }) => {
    await setup(page, { finding: true, tagFailure });
    await analyze(page);
    await page.getByRole('tab', { name: '원문', exact: true }).click();
    const expand = page.getByRole('button', { name: '주의 표현 목록 펼치기', exact: true });
    if (await expand.count()) await expand.click();
    const expected = tagFailure ? '위험·협박' : '서버에서 관리하는 협박 명칭';
    await expect(page.getByRole('region', { name: '탐지된 위험 표현 목록 (1)' }).getByText(expected, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '전송하기', exact: true })).toBeEnabled();
  });
}

test('HTTP 새 문의에서 마스킹·분석·findings·상세 탐지를 호출하고 점수와 수정 이유를 표시한다', async ({ page }) => {
  const calls = await setup(page);
  await analyze(page);
  const results = page.getByRole('region', { name: '위험 분석 결과' });
  await expect(results).toContainText('위험 점수: 30/100');
  await expect(results).toContainText('요청을 구체적이고 부드럽게 표현했습니다.');
  await results.getByText('상세 탐지 결과 보기', { exact: true }).click();
  await results.getByRole('button', { name: '서버에서 관리하는 협박 명칭 경계', exact: true }).click();
  await expect(results).toContainText('규칙 분석');
  await expect(results).toContainText('신뢰도: 0%');
  await expect(results).toContainText('신뢰도: 65%');
  await expect(results.getByText('상담 시간을 알려 주세요.', { exact: true })).toBeVisible();
  await expect(results).toContainText('test-detector');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(calls).toEqual(expect.arrayContaining(['GET /risk-tags', 'POST /complaints/42/mask', 'POST /complaints/42/risk-analysis', 'GET /risk-analyses/7/findings', 'GET /risk-analyses/7/detector-results']));
});

test('HTTP 모드에서 서버 ID가 없는 로컬 문의는 mock 분석으로 진행하지 않는다', async ({ page }) => {
  const calls = await setup(page, { followUp: true, localOnly: true });
  await expect(page.getByText('서버에 등록되지 않은 문의입니다. 새 문의로 작성해 주세요.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'AI 분석 시작', exact: true })).toHaveCount(0);
  expect(calls.some((call) => call.includes('/risk-analysis'))).toBe(false);
  await page.getByRole('button', { name: '새 문의 작성', exact: true }).click();
  await expect(page).toHaveURL(/\/parent\/messages\/new\?fresh=1$/);
});

test('추가 문의는 서버 메시지 초안부터 분석·전송까지 연결되고 기존 대화에 한 번만 추가된다', async ({ page }) => {
  const calls = await setup(page, { followUp: true });
  await analyze(page);
  await page.getByRole('tab', { name: '원문', exact: true }).click();
  await page.getByRole('button', { name: '전송하기', exact: true }).click();
  await page.getByRole('button', { name: '확인 후 전송', exact: true }).click();
  await expect(page).toHaveURL(/\/parent\/messages\/thread-local$/);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('teacher-hub.parent-sent-messages.101')!));
  expect(stored).toHaveLength(1);
  expect(stored[0].conversation.at(-1).body).toBe(maskedContent);
  expect(calls).toEqual(expect.arrayContaining(['PUT /complaints/42/message-draft', 'POST /complaints/42/messages/101/risk-analysis', 'POST /complaints/42/messages/101/send', 'GET /risk-analyses/8/findings']));
  expect(calls).not.toContain('POST /complaints');
  expect(calls).not.toContain('POST /complaints/42/mask');
});

for (const closeConflict of [false, true]) {
  test(`학부모 문의 완료 ${closeConflict ? '충돌 시 상태를 다시 조회한다' : '성공을 상세 화면에 반영한다'}`, async ({ page }) => {
    const calls = await setup(page, { lifecycle: { status: 'ANSWERED', closeConflict } });
    const close = page.getByRole('button', { name: '문의 완료', exact: true });
    await expect(page.getByRole('button', { name: '추가 문의하기', exact: true })).toBeEnabled();
    await close.click();
    const details = page.getByRole('region', { name: '문의 정보', exact: true });
    await expect(details.getByText('상담 완료', { exact: true })).toBeVisible();
    await expect(close).toHaveCount(0);
    await expect(page.getByRole('button', { name: '추가 문의하기', exact: true })).toBeEnabled();
    const closeIndex = calls.indexOf('POST /complaints/42/close');
    expect(calls.filter((call) => call === 'POST /complaints/42/close')).toHaveLength(1);
    if (closeConflict) {
      expect(calls.slice(closeIndex + 1)).toContain('GET /complaints/42/messages');
      await expect(page.getByText('이미 종료된 민원입니다.', { exact: true })).toBeVisible();
    }
  });
}

test('창에 포커스가 돌아와 대화를 조회하는 동안에도 한 번의 클릭으로 문의를 완료한다', async ({ page }) => {
  const calls = await setup(page, { lifecycle: { status: 'ANSWERED' } });
  const close = page.getByRole('button', { name: '문의 완료', exact: true });
  await expect(close).toBeEnabled();

  let finishRefresh!: () => void;
  const refreshGate = new Promise<void>((resolve) => { finishRefresh = resolve; });
  await page.route('**/api/complaints/42/messages', async (route) => {
    await refreshGate;
    await route.fallback();
  });
  const refreshStarted = page.waitForRequest((request) => request.method() === 'GET' &&
    new URL(request.url()).pathname === '/api/complaints/42/messages');

  try {
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await refreshStarted;
    await expect(close).toBeEnabled({ timeout: 2000 });
    await close.click();
    const details = page.getByRole('region', { name: '문의 정보', exact: true });
    await expect(details.getByText('상담 완료', { exact: true })).toBeVisible();
    expect(calls.filter((call) => call === 'POST /complaints/42/close')).toHaveLength(1);
  } finally {
    finishRefresh();
  }
});

for (const reopened of [false, true]) {
  test(`늦은 종료 응답을 적용할 수 없으면 최신 조회에서 ${reopened ? '재개된 문의를 유지한다' : '종료 상태를 복원한다'}`, async ({ page }) => {
    const initialRead = page.waitForResponse((response) => response.url().endsWith('/api/complaints/42/messages'));
    await setup(page, { lifecycle: { status: 'ANSWERED' } });
    const answered: ParentConversationResponse = await (await initialRead).json();
    const openConversation: ParentConversationResponse = { ...answered, status: 'OPEN', waitingFor: 'TEACHER', messages: [...answered.messages] };
    if (reopened) {
      openConversation.messages.push({ messageId: 3, type: 'PARENT_INQUIRY', senderRole: 'PARENT', senderName: 'Demo Parent',
        content: '다른 기기에서 보낸 추가 문의', status: 'SENT', sentAt: '2026-10-30T10:03:00', readAt: null });
    }

    let finishClose!: () => void;
    const closeGate = new Promise<void>((resolve) => { finishClose = resolve; });
    await page.route('**/api/complaints/42/close', async (route) => {
      await closeGate;
      await route.fallback();
    });
    let reads = 0;
    await page.route('**/api/complaints/42/messages', async (route) => {
      reads += 1;
      if (reads === 1 || reopened) await route.fulfill({ json: openConversation });
      else await route.fallback();
    });

    try {
      await page.getByRole('button', { name: '문의 완료', exact: true }).click();
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      const waiting = page.getByText(/선생님의 답변을 기다리고 있어요/);
      await expect(waiting).toBeVisible();
      finishClose();
      await expect.poll(() => reads, { timeout: 4000 }).toBeGreaterThanOrEqual(2);
      if (reopened) {
        await expect(waiting).toBeVisible();
        await expect(page.getByText('상담 완료', { exact: true })).toHaveCount(0);
      } else {
        await expect(page.getByText('상담 완료', { exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: '추가 문의하기', exact: true })).toBeEnabled();
      }
    } finally {
      finishClose();
    }
  });
}

for (const status of ['ANSWERED', 'CLOSED'] as const) {
  test(`${status} 문의에 추가 문의를 보내면 기존 민원이 교사 답변 대기로 재개된다`, async ({ page }) => {
    const calls = await setup(page, { followUp: true, lifecycle: { status } });
    if (status === 'CLOSED') {
      await expect(page.getByText('상담 완료', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: '문의 완료', exact: true })).toHaveCount(0);
    }
    await page.getByRole('button', { name: '추가 문의하기', exact: true }).click();
    await expect(page).toHaveURL(/\/parent\/messages\/thread-local$/);
    await expect(page.getByLabel('문의 내용', { exact: true })).toBeFocused();
    expect(calls.filter((call) => /^(POST|PUT|PATCH) /.test(call))).toEqual([]);
    await analyze(page);
    await page.getByRole('tab', { name: '원문', exact: true }).click();
    await page.getByRole('button', { name: '전송하기', exact: true }).click();
    await page.getByRole('button', { name: '확인 후 전송', exact: true }).click();
    await expect(page).toHaveURL(/\/parent\/messages\/thread-local$/);
    await page.getByRole('status').getByRole('link', { name: '문의 내역', exact: true }).click();
    await page.getByRole('link', { name: /기존 서버 문의/ }).click();
    const conversation = page.getByRole('region', { name: '전체 대화 내역', exact: true });
    await expect(conversation.getByText(maskedContent, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /문의 완료|추가 문의하기/ })).toHaveCount(0);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('teacher-hub.parent-sent-messages.101')!));
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ serverComplaintId: 42, serverComplaintStatus: 'OPEN', serverWaitingFor: 'TEACHER' });
    expect(calls).not.toContain('POST /complaints');
  });
}

test('인라인 작성 중 교사 답변 대기로 바뀌면 내용을 보존하고 분석을 차단한다', async ({ page }) => {
  const calls = await setup(page, { followUp: true, lifecycle: { status: 'ANSWERED' } });
  await page.getByRole('button', { name: '추가 문의하기', exact: true }).click();
  const input = page.getByLabel('문의 내용', { exact: true });
  await input.fill('작성 중인 추가 문의를 보존합니다.');
  await expect(page.getByRole('button', { name: '문의 완료', exact: true })).toBeDisabled();
  await page.route('**/api/complaints/42/messages', async (route) => route.fulfill({ json: {
    complaintId: 42, status: 'OPEN', waitingFor: 'TEACHER', messages: [{
      messageId: 1, type: 'PARENT_INQUIRY', senderRole: 'PARENT', senderName: 'Demo Parent', content: thread.finalBody,
      status: 'SENT', sentAt: thread.sentAt, readAt: null,
    }, {
      messageId: 2, type: 'TEACHER_REPLY', senderRole: 'TEACHER', senderName: thread.teacherName, content: '확인한 답변입니다.',
      status: 'READ', sentAt: '2026-10-29T20:00:00Z', readAt: null,
    }, {
      messageId: 3, type: 'PARENT_INQUIRY', senderRole: 'PARENT', senderName: 'Demo Parent', content: '다른 기기에서 전송한 문의',
      status: 'SENT', sentAt: '2026-10-30T10:03:00', readAt: null,
    }],
  } }));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('button', { name: 'AI 분석 시작', exact: true })).toBeDisabled();
  await expect(input).toHaveValue('작성 중인 추가 문의를 보존합니다.');
  await page.getByRole('button', { name: '추가 문의 입력창 접기', exact: true }).click();
  await expect(input).toHaveCount(0);
  await expect(page.getByRole('button', { name: '추가 문의하기', exact: true })).toHaveCount(0);
  expect(calls.filter((call) => /^(POST|PUT|PATCH) /.test(call))).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('teacher-hub.parent-message-draft.101'))).toContain('작성 중인 추가 문의를 보존합니다.');
});

test('인라인 추가 문의에서도 서버 초안을 복원하고 버전 충돌 시 본문을 보존한다', async ({ page }) => {
  const calls = await setup(page, { followUp: true, conflict: true, lifecycle: { status: 'ANSWERED' } });
  await page.getByRole('button', { name: '추가 문의하기', exact: true }).click();
  await expect(page.getByLabel('문의 내용', { exact: true })).toHaveValue('내가 작성한 내용');
  await page.getByRole('button', { name: 'AI 분석 시작', exact: true }).click();
  await expect(page.getByText(/서버의 추가 문의 초안이 변경되었습니다/)).toBeVisible();
  await expect(page).toHaveURL(/\/parent\/messages\/thread-local$/);
  await expect(page.getByLabel('문의 내용', { exact: true })).toHaveValue('내가 작성한 내용');
  expect(calls).not.toContain('PUT /complaints/42/message-draft');
  await page.getByRole('button', { name: '서버 초안 불러오기', exact: true }).click();
  await expect(page.getByLabel('문의 내용', { exact: true })).toHaveValue('다른 탭의 초안');
});

test('서버 마스킹 실패 시 작성 내용을 유지하고 분석을 중단한다', async ({ page }) => {
  const calls = await setup(page, { maskFailure: true });
  await page.getByLabel('문의 내용', { exact: true }).fill(body);
  await page.getByRole('button', { name: 'AI 분석 시작', exact: true }).click();
  await expect(page.getByLabel('문의 내용', { exact: true })).toHaveValue(body);
  await expect(page.getByRole('alert').filter({ hasText: /잠시 후/ })).toBeVisible();
  expect(calls).not.toContain('POST /complaints/42/risk-analysis');
});

test('상세 탐지만 실패하면 수정안을 유지하고 해당 조회를 재시도한다', async ({ page }) => {
  const calls = await setup(page, { detectorFailure: true });
  await analyze(page);
  await page.getByText('상세 탐지 결과 보기', { exact: true }).click();
  await expect(page.getByRole('button', { name: '다시 불러오기', exact: true })).toBeVisible();
  const beforeRetry = calls.filter((call) => call === 'GET /risk-analyses/7/detector-results').length;
  await page.route('**/risk-analyses/7/detector-results', (route) => route.fulfill({ json: detector }));
  await page.getByRole('button', { name: '다시 불러오기', exact: true }).click();
  await expect(page.getByRole('button', { name: '서버에서 관리하는 협박 명칭 경계', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '전송하기', exact: true })).toBeEnabled();
  expect(beforeRetry).toBeGreaterThanOrEqual(1);
});

test('다른 탭에서 바뀐 추가 문의 초안은 덮어쓰지 않고 작성 내용을 유지한다', async ({ page }) => {
  const calls = await setup(page, { followUp: true, conflict: true });
  await page.getByRole('button', { name: 'AI 분석 시작', exact: true }).click();
  await expect(page.getByText(/서버의 추가 문의 초안이 변경되었습니다/)).toBeVisible();
  await expect(page.getByLabel('문의 내용', { exact: true })).toHaveValue('내가 작성한 내용');
  expect(calls).not.toContain('PUT /complaints/42/message-draft');
  await page.getByRole('button', { name: '서버 초안 불러오기', exact: true }).click();
  await expect(page.getByLabel('문의 내용', { exact: true })).toHaveValue('다른 탭의 초안');
});

test('전송 직전 다른 기기에서 바뀐 추가 문의 초안은 전송하지 않고 안내한다', async ({ page }) => {
  await setup(page, { followUp: true, changedBeforeSend: true });
  await analyze(page);
  await page.getByRole('button', { name: '전송하기', exact: true }).click();
  await page.getByRole('button', { name: '확인 후 전송', exact: true }).click();
  await expect(page.getByText(/초안이 변경되어 전송하지 않았습니다/)).toBeVisible();
  await expect(page).toHaveURL(/\/review$/);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('teacher-hub.parent-sent-messages.101')!));
  expect(stored[0].conversation ?? []).toHaveLength(0);
});

test('초안 불러오기 응답이 늦게 와도 그동안 입력한 내용을 덮어쓰지 않는다', async ({ page }) => {
  await setup(page, { followUp: true, conflict: true });
  await page.getByRole('button', { name: 'AI 분석 시작', exact: true }).click();
  await expect(page.getByRole('button', { name: '서버 초안 불러오기', exact: true })).toBeVisible();
  let release!: () => void;
  let markRequested!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  const requested = new Promise<void>((resolve) => { markRequested = resolve; });
  await page.route('**/api/complaints/42/message-draft', async (route) => {
    markRequested();
    await pending;
    await route.fulfill({ json: { messageId: 101, complaintId: 42, content: '서버에서 읽은 내용', contentVersion: 2 } });
  });
  await page.getByRole('button', { name: '서버 초안 불러오기', exact: true }).click();
  await requested;
  await page.getByLabel('문의 내용', { exact: true }).fill('불러오는 동안 새로 입력한 내용');
  release();
  await expect(page.getByText('불러오는 동안 내용이 변경되어 현재 입력한 내용을 유지했습니다.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('문의 내용', { exact: true })).toHaveValue('불러오는 동안 새로 입력한 내용');
});

test('추가 문의 저장 후 전송이 실패해도 문장을 바꿔 다시 전송할 수 있다', async ({ page }) => {
  await setup(page, { followUp: true, failFollowUpSendOnce: true });
  await analyze(page);
  await page.getByRole('button', { name: '전송하기', exact: true }).click();
  await page.getByRole('button', { name: '확인 후 전송', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: /잠시 후/ })).toBeVisible();
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await page.getByRole('textbox', { name: 'AI 초안 내용', exact: true }).fill('전송 실패 후 수정한 문장');
  await page.getByRole('button', { name: '전송하기', exact: true }).click();
  await page.getByRole('button', { name: '확인 후 전송', exact: true }).click();
  await expect(page).toHaveURL(/\/parent\/messages\/thread-local$/);
  const messages = await page.evaluate(() => JSON.parse(localStorage.getItem('teacher-hub.parent-sent-messages.101')!));
  expect(messages[0].conversation.at(-1)).toMatchObject({ body: '전송 실패 후 수정한 문장', serverMessageId: 101 });
});

for (const [index, status] of (['COMPLETED', 'REUSED', 'REUSED_RULE_ONLY', 'RULE_ONLY_AI_UNAVAILABLE', 'RULE_ONLY_INVALID_RESPONSE'] as const).entries()) {
  test(`${status}: 새 문의와 추가 문의에서 상태값으로 잠정 분석을 구분한다`, async ({ page }) => {
    const provisional = status !== 'COMPLETED' && status !== 'REUSED';
    await setup(page, { followUp: index % 2 === 1, noRevision: provisional, summary: {
      aiAnalysisStatus: status, analysisMode: provisional ? 'RULE_ONLY' : 'HYBRID',
      manualReviewRequired: provisional, analysisMessage: '응답 메시지는 화면 분기 기준이 아닙니다.',
      riskScore: 75, riskLevel: 'EMERGENCY',
    } });
    await analyze(page);
    const results = page.getByRole('region', { name: '위험 분석 결과' });
    await expect(results).toContainText('위험 점수: 75/100');
    await expect(results).toContainText('긴급');
    await expect(results.getByText('잠정 분석', { exact: true })).toHaveCount(provisional ? 1 : 0);
    if (provisional) {
      await expect(results).toContainText('교사의 직접 검토가 필요합니다.');
      await expect(page.getByRole('tab', { name: 'AI 초안', exact: true })).toBeDisabled();
    }
    await expect(page.getByRole('button', { name: '전송하기', exact: true })).toBeEnabled();
    // Persisted analyses retain their metadata across reloads.
    await page.reload();
    await expect(results.getByText('잠정 분석', { exact: true })).toHaveCount(provisional ? 1 : 0);
  });
}

test('분석 모드와 수동 검토 플래그는 상태값이 없는 이전 응답에서도 적용한다', async ({ page }) => {
  await setup(page, { summary: { analysisMode: 'RULE_ONLY', manualReviewRequired: true } });
  await analyze(page);
  await expect(page.getByText('잠정 분석', { exact: true })).toBeVisible();
  await expect(page.getByText('교사의 직접 검토가 필요합니다.', { exact: true })).toBeVisible();
});

for (const severity of [0, 1, 2, 3, null] as const) {
  test(`심각도 ${severity}: 반복 횟수와 안전 신호의 true·false·null을 구분한다`, async ({ page }) => {
    await setup(page, { detector: {
      analysisId: 7, llm: null,
      results: [{ code: 'THREAT', finalState: 'PRESENT', rule: null,
        llm: { state: severity === null ? 'BOUNDARY' : severity === 0 ? 'ABSENT' : 'PRESENT',
          confidence: null, severity, repeatCount: severity === null ? null : 5, evidenceSpans: [] } }],
      safetyFlags: { credibleThreat: true, studentSafetyConcern: null, privacyExposure: false },
    } });
    await analyze(page);
    const results = page.getByRole('region', { name: '위험 분석 결과' });
    await expect(results).toContainText('긴급 안전 신호');
    await expect(results).toContainText('학생 안전 위험: 현재 정보만으로 안전 신호를 판단할 수 없습니다.');
    await expect(results).not.toContainText('개인정보 노출 또는 유포 위험이 감지');
    await results.getByText('상세 탐지 결과 보기', { exact: true }).click();
    await results.getByRole('button', { name: '서버에서 관리하는 협박 명칭 탐지', exact: true }).click();
    await expect(results).toContainText(`심각도: ${severity === null ? '경계 사례' : ['해당 없음', '경미', '보통', '심각'][severity]}`);
    await expect(results).toContainText(severity === null ? '반복 횟수 정보 없음' : '현재 민원에서 5회 감지');
    // Safety flags do not cause the client to recalculate the returned score or level.
    await expect(results).toContainText('위험 점수: 30/100');
  });
}

test('UNKNOWN과 누락된 안전 신호는 위험 없음으로 표시하지 않는다', async ({ page }) => {
  await setup(page, { detector: { analysisId: 7, llm: null, results: [
    { code: 'THREAT', finalState: 'UNKNOWN', rule: null, llm: { state: 'UNKNOWN', confidence: null } },
  ] } });
  await analyze(page);
  const results = page.getByRole('region', { name: '위험 분석 결과' });
  await expect(results).toContainText('안전 신호 정보가 제공되지 않았습니다.');
  await results.getByText('상세 탐지 결과 보기', { exact: true }).click();
  await results.getByRole('button', { name: '서버에서 관리하는 협박 명칭 미확인', exact: true }).click();
  await expect(results).toContainText('심각도: 판단 정보 부족');
});

for (const code of ['PRIVACY_MASKING_FAILED', 'RISK_RULE_PROCESSING_FAILED', 'RISK_SCORE_CALCULATION_FAILED', 'RISK_ANALYSIS_SAVE_FAILED']) {
  test(`${code}: 내부 분석 오류는 검토 화면으로 넘기거나 전송하지 않는다`, async ({ page }) => {
    const calls = await setup(page, { analysisErrorCode: code });
    await page.getByLabel('문의 내용', { exact: true }).fill(body);
    await page.getByRole('button', { name: 'AI 분석 시작', exact: true }).click();
    await expect(page.getByText(/분석과 전송을 중단했습니다/)).toBeVisible();
    await expect(page.getByLabel('문의 내용', { exact: true })).toHaveValue(body);
    await expect(page).not.toHaveURL(/\/review$/);
    expect(calls).not.toContain('GET /risk-analyses/7/findings');
    expect(calls).not.toContain('POST /complaints/42/send');
    await expect(page.getByText('Internal Java exception')).toHaveCount(0);
  });

  test(`${code}: 최종 전송 실패 시 원문과 초안을 보존한다`, async ({ page }) => {
    const calls = await setup(page, { sendErrorCode: code });
    await analyze(page);
    await page.getByRole('button', { name: '전송하기', exact: true }).click();
    await page.getByRole('button', { name: '확인 후 전송', exact: true }).click();
    await expect(page.getByText(/분석과 전송을 중단했습니다/)).toBeVisible();
    await expect(page).toHaveURL(/\/review$/);
    await expect(page.getByRole('textbox', { name: 'AI 초안 내용', exact: true })).toHaveValue('상담 가능한 시간을 안내해 주세요.');
    expect(calls.filter((call) => call === 'POST /complaints/42/send')).toHaveLength(1);
    expect(await page.evaluate(() => localStorage.getItem('teacher-hub.parent-message-draft.101'))).not.toBeNull();
    expect(await page.evaluate(() => localStorage.getItem('teacher-hub.parent-sent-messages.101'))).toBeNull();
  });
}

for (const followUp of [false, true]) {
  test(`SKIPPED_LIMIT: ${followUp ? '추가 문의' : '새 문의'} 전송 후 이전 분석 점수를 재사용하지 않는다`, async ({ page }) => {
    await setup(page, { followUp, summary: { riskScore: 95 },
      submission: { aiAnalysisStatus: 'SKIPPED_LIMIT', riskAnalysis: null } });
    await analyze(page);
    await page.getByRole('button', { name: '전송하기', exact: true }).click();
    await page.getByRole('button', { name: '확인 후 전송', exact: true }).click();
    await expect(page.getByRole('heading', { name: '전송 완료', exact: true })).toBeVisible();
    await expect(page.getByText('분석 횟수 제한', { exact: true })).toBeVisible();
    await expect(page.getByText(/최종 전송 내용의 시스템 위험 점수/)).toHaveCount(0);
    const messages = await page.evaluate(() => JSON.parse(localStorage.getItem('teacher-hub.parent-sent-messages.101')!));
    expect(messages[0].submissionAnalysis).toMatchObject({ aiAnalysisStatus: 'SKIPPED_LIMIT' });
    expect(messages[0].submissionAnalysis.riskScore).toBeUndefined();
  });
}

test('최종 제출은 현재 백엔드의 submissionAnalysisStatus와 최신 위험 점수를 표시한다', async ({ page }) => {
  await setup(page, { summary: { riskScore: 95 }, submission: {
    submissionAnalysisStatus: 'RULE_ONLY_INVALID_RESPONSE',
    riskAnalysis: { analysisId: 9, complaintId: 42, riskScore: 25, riskLevel: 'MEDIUM',
      aiAnalysisStatus: 'RULE_ONLY_INVALID_RESPONSE', analysisMode: 'RULE_ONLY', manualReviewRequired: true },
  } });
  await analyze(page);
  await page.getByRole('button', { name: '전송하기', exact: true }).click();
  await page.getByRole('button', { name: '확인 후 전송', exact: true }).click();
  await expect(page.getByText('최종 전송 내용의 시스템 위험 점수: 25/100', { exact: true })).toBeVisible();
  await expect(page.getByText('잠정 분석', { exact: true })).toBeVisible();
  await expect(page.getByText('교사의 직접 검토가 필요합니다.', { exact: true })).toBeVisible();
});

test('추가 문의의 내부 안전 오류는 대화 재조회로 전송 성공 처리하지 않는다', async ({ page }) => {
  const calls = await setup(page, { followUp: true, sendErrorCode: 'RISK_ANALYSIS_SAVE_FAILED' });
  await analyze(page);
  await page.getByRole('button', { name: '전송하기', exact: true }).click();
  await page.getByRole('button', { name: '확인 후 전송', exact: true }).click();
  await expect(page.getByText(/분석 결과를 저장하지 못해 분석과 전송을 중단했습니다/)).toBeVisible();
  await expect(page).toHaveURL(/\/review$/);
  expect(calls).not.toContain('GET /complaints/42/messages');
});

for (const metadata of [
  { aiAnalysisStatus: 'REUSED_RULE_ONLY' }, { aiAnalysisStatus: 'RULE_ONLY_AI_UNAVAILABLE' },
  { aiAnalysisStatus: 'RULE_ONLY_INVALID_RESPONSE' }, { manualReviewRequired: true },
] satisfies Partial<RiskSummaryResponse>[]) {
  test(`독립 상태값 ${JSON.stringify(metadata)}만 있어도 검토 안내를 표시한다`, async ({ page }) => {
    await setup(page, { summary: metadata });
    await analyze(page);
    const results = page.getByRole('region', { name: '위험 분석 결과' });
    if ('aiAnalysisStatus' in metadata) await expect(results.getByText('잠정 분석', { exact: true })).toBeVisible();
    else await expect(results.getByText('교사의 직접 검토가 필요합니다.', { exact: true })).toBeVisible();
  });
}

test('반복 횟수 0을 보존하고 모든 안전 신호가 false이면 경고하지 않는다', async ({ page }) => {
  await setup(page, { detector: { analysisId: 7, llm: null,
    results: [{ code: 'THREAT', finalState: 'ABSENT', rule: null,
      llm: { state: 'ABSENT', confidence: null, severity: 0, repeatCount: 0 } }],
    safetyFlags: { credibleThreat: false, studentSafetyConcern: false, privacyExposure: false },
  } });
  await analyze(page);
  await expect(page.getByRole('region', { name: '안전 신호', exact: true })).toHaveCount(0);
  await page.getByText('상세 탐지 결과 보기', { exact: true }).click();
  await page.getByRole('button', { name: '서버에서 관리하는 협박 명칭 미탐지', exact: true }).click();
  await expect(page.getByText('현재 민원에서 0회 감지', { exact: true })).toBeVisible();
});
