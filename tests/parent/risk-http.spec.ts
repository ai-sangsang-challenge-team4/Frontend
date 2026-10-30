import { expect, test, type Page } from '@playwright/test';

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

async function setup(page: Page, options: { followUp?: boolean; maskFailure?: boolean; detectorFailure?: boolean; conflict?: boolean; localOnly?: boolean; failFollowUpSendOnce?: boolean; changedBeforeSend?: boolean } = {}) {
  const calls: string[] = [];
  let content = maskedContent;
  let savedFollowUp = false;
  let sendAttempts = 0;
  // The server's contentVersion: it grows only when the content changes.
  let version = 1;
  const failDetector = options.detectorFailure;
  const versionConflict = { code: 'CONTENT_VERSION_CONFLICT', message: '추가 문의 초안이 다른 기기에서 변경되었습니다.' };
  const followUp = () => ({ messageId: 101, complaintId: 42, content, contentVersion: version, status: 'DRAFT', waitingFor: 'PARENT', createdAt: '2026-10-30T10:00:00', updatedAt: '2026-10-30T10:00:00', sentAt: null });
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api', '');
    const key = `${request.method()} ${path}`;
    calls.push(key);
    let json: unknown;
    let status = 200;
    switch (key) {
      case 'GET /complaints': json = { content: [{ studentId: 10, studentName: 'Demo Student' }], hasNext: false, totalPages: 1 }; break;
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
        json = { analysisId: options.followUp ? 8 : 7, complaintId: 42, riskScore: 30, riskLevel: 'HIGH' }; break;
      case 'GET /risk-analyses/7/findings':
      case 'GET /risk-analyses/8/findings': json = { findings: [], finalRevision: { content: '상담 가능한 시간을 안내해 주세요.', reason: '요청을 구체적이고 부드럽게 표현했습니다.' } }; break;
      case 'GET /risk-analyses/7/detector-results':
      case 'GET /risk-analyses/8/detector-results':
        status = failDetector ? 500 : 200;
        json = failDetector ? { code: 'INTERNAL_SERVER_ERROR' } : detector;
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
        status = options.failFollowUpSendOnce && sendAttempts === 1 ? 500 : 200;
        json = status === 500 ? { code: 'INTERNAL_SERVER_ERROR' }
          : { ...followUp(), status: 'SENT', waitingFor: 'TEACHER', sentAt: '2026-10-30T10:03:00' }; break;
      case 'GET /complaints/42/messages': json = { complaintId: 42, messages: [] }; break;
      case 'POST /complaints/42/send': json = { message: '제출됨' }; break;
      default: throw new Error(`Unexpected request: ${key}`);
    }
    await route.fulfill({ status, json });
  });
  if (options.followUp) await page.addInitScript(({ initial, conflict }) => {
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
  if (options.followUp) await page.goto('/parent/messages/thread-local/follow-up');
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

test('HTTP 새 문의에서 마스킹·분석·findings·상세 탐지를 호출하고 점수와 수정 이유를 표시한다', async ({ page }) => {
  const calls = await setup(page);
  await analyze(page);
  const results = page.getByRole('region', { name: '위험 분석 결과' });
  await expect(results).toContainText('위험 점수: 3점');
  await expect(results).toContainText('요청을 구체적이고 부드럽게 표현했습니다.');
  await results.getByText('상세 탐지 결과 보기', { exact: true }).click();
  await results.getByRole('button', { name: '위험·협박 경계', exact: true }).click();
  await expect(results).toContainText('규칙 분석');
  await expect(results).toContainText('신뢰도: 0%');
  await expect(results).toContainText('신뢰도: 65%');
  await expect(results.getByText('상담 시간을 알려 주세요.', { exact: true })).toBeVisible();
  await expect(results).toContainText('test-detector');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(calls).toEqual(expect.arrayContaining(['POST /complaints/42/mask', 'POST /complaints/42/risk-analysis', 'GET /risk-analyses/7/findings', 'GET /risk-analyses/7/detector-results']));
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
  await expect(page.getByRole('button', { name: '위험·협박 경계', exact: true })).toBeVisible();
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
