import { expect, test, type Page } from '@playwright/test';
import type { ParentConversationResponse, RiskDetectorResponse, RiskRevisionResponse, RiskSummaryResponse, SubmissionAnalysisResponse } from '../../src/features/parent-message/api/parentComplaintTypes';

const body = '상담 시간을 알려 주세요. 010-1234-5678';
const maskedContent = '상담 시간을 알려 주세요. [전화번호]';
const privacyScopeTooltip = '전화번호·이메일·주민등록번호와 확인된 학부모·자녀·교사 이름을 자동으로 가립니다.';
const savedDraftTooltip = '마스킹 결과를 확인하거나 분석을 시작하면 서버 초안이 생성되어 자녀·문의 대상·제목이 확정됩니다. 문의 내용은 계속 수정할 수 있습니다.';
const detector: RiskDetectorResponse = {
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
  findingsResponse?: Partial<RiskRevisionResponse>;
  analysisErrorCode?: string; sendErrorCode?: string; noRevision?: boolean;
  lifecycle?: { status: 'OPEN' | 'ANSWERED' | 'CLOSED'; waitingFor?: 'PARENT' | 'TEACHER'; closeConflict?: boolean };
  uncachedFollowUp?: boolean; cachedAnswered?: boolean; studentName?: string;
} = {}) {
  const calls: string[] = [];
  const studentName = options.studentName ?? 'Demo Student';
  let content = maskedContent;
  let savedFollowUp = false;
  let sendAttempts = 0;
  let complaintStatus: ParentConversationResponse['status'] = options.lifecycle?.status ?? (options.followUp ? 'ANSWERED' : 'OPEN');
  let followUpSentAt: string | null = null;
  // The server's contentVersion: it grows only when the content changes.
  let version = 1;
  const failDetector = options.detectorFailure;
  const versionConflict = { code: 'CONTENT_VERSION_CONFLICT', message: '추가 문의 초안이 다른 기기에서 변경되었습니다.' };
  const followUp = () => ({ messageId: 101, complaintId: 42, content, contentVersion: version, status: 'DRAFT', waitingFor: 'PARENT', createdAt: '2026-10-30T10:00:00', updatedAt: '2026-10-30T10:00:00', sentAt: null });
  const waitingFor = () => complaintStatus === 'CLOSED' ? 'NONE' : complaintStatus === 'ANSWERED' ? 'PARENT'
    : (!followUpSentAt && options.lifecycle?.waitingFor === 'PARENT') ? 'PARENT' : 'TEACHER';
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
      case 'GET /users/me': json = { userId: 101, email: 'parent@example.com', name: 'Demo Parent', role: 'PARENT', students: [{ studentId: 10, name: studentName, studentNo: '1' }] }; break;
      case 'GET /complaints/recipients': json = [{ teacherId: 20, teacherName: 'Demo Teacher', homeroomTeacher: true }]; break;
      case 'GET /complaints/42': json = {
        complaintId: 42, title: thread.title, teacherName: thread.teacherName, content: thread.finalBody,
        studentId: 10, studentName, parentName: 'Demo Parent', riskLevel: null,
        status: complaintStatus, waitingFor: waitingFor(), createdAt: thread.sentAt, updatedAt: followUpSentAt ?? thread.sentAt,
      }; break;
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
      case 'GET /risk-analyses/8/findings': json = {
        findings: options.finding ? [{ code: 'THREAT', evidences: ['상담 시간을 알려 주세요.'], revisionSuggestions: [] }] : [],
        finalRevision: options.noRevision ? null : { content: '상담 가능한 시간을 안내해 주세요.', reason: '요청을 구체적이고 부드럽게 표현했습니다.' },
        ...options.findingsResponse,
      }; break;
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
  if ((options.followUp || options.lifecycle) && !options.uncachedFollowUp) await page.addInitScript(({ initial, conflict }) => {
    localStorage.setItem('teacher-hub.parent-sent-messages.101', JSON.stringify([initial]));
    if (conflict) localStorage.setItem('teacher-hub.parent-message-draft.101', JSON.stringify({
      messageId: 'follow-up-local', teacherId: '20', title: initial.title, body: '내가 작성한 내용', status: 'DRAFT', threadId: initial.messageId,
      server: { complaintId: 42, serverMessageId: 101, teacherId: 20, teacherName: 'Demo Teacher', title: initial.title, content: '이전에 저장한 내용', analysisId: null },
    }));
  }, { initial: { ...thread, serverComplaintId: options.localOnly ? undefined : thread.serverComplaintId,
    ...(options.cachedAnswered ? { serverComplaintStatus: 'ANSWERED', serverWaitingFor: 'PARENT' } : {}) }, conflict: options.conflict });
  await page.goto('/login?role=PARENT');
  await page.locator('input[name="email"]').fill('parent@example.com');
  await page.locator('input[name="password"]').fill('password123');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page).toHaveURL(/\/parent\/messages\/new$/);
  if (options.uncachedFollowUp) await page.goto('/parent/messages/server-42/follow-up');
  else if (options.lifecycle) await page.goto('/parent/messages/thread-local');
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

test('작성 화면에서 친구의 전체 이름과 성을 뺀 이름을 저장 없이 바로 가린다', async ({ page }) => {
  const calls = await setup(page, { studentName: '이도윤' });
  const title = page.getByLabel('문의 제목', { exact: true });
  const editor = page.getByLabel('문의 내용', { exact: true });
  const privacy = page.getByRole('region', { name: '개인정보 마스킹 상태', exact: true });
  const preview = privacy.locator('.privacy-masking-preview p');
  const original = '이도윤 학생 학부모입니다. 도윤이가 서윤이에게 김서윤';
  await title.fill('');
  await editor.fill(original);
  await privacy.getByText('마스킹 결과 보기', { exact: true }).click();
  await expect(preview).toContainText('[이름] 학생 학부모입니다. [이름]이가 [이름]이에게 [이름]');
  await expect(preview).not.toContainText('서윤');
  await expect(privacy).toContainText('4건 마스킹');
  await expect(editor).toHaveValue(original);
  await privacy.getByRole('button', { name: '개인정보 확인 범위', exact: true }).focus();
  await expect(page.getByRole('tooltip')).toHaveText(privacyScopeTooltip);
  await page.keyboard.press('Escape');

  await editor.fill('도윤이가 같은 반 친구인 서윤이에게 우산을 건넸습니다. 같은 반 친구인 어린이에게도 인사했습니다.');
  await expect(preview).toContainText('[이름]이가 같은 반 친구인 [이름]이에게 우산을 건넸습니다. 같은 반 친구인 어린이에게도 인사했습니다.');
  await expect(title).toBeEditable();
  expect(calls.filter((call) => /^(POST|PATCH) \/complaints/.test(call))).toEqual([]);
});

test('작성 미리보기에서 서버가 같은 반 학생 이름을 가리고 수정할 때 같은 초안을 사용한다', async ({ page }) => {
  const calls = await setup(page, { studentName: '이도윤', noRevision: true });
  const writes = () => calls.filter((call) => /^(POST|PATCH) \/complaints/.test(call));
  const title = page.getByLabel('문의 제목', { exact: true });
  const editor = page.getByLabel('문의 내용', { exact: true });
  const original = '김서윤이 도윤이 서윤이';
  const masked = '[제3자 학생명]이 [이름]이 [제3자 학생명]이';
  const edited = '[제3자 학생명] 학생에게 안내해 주세요.';
  await page.route('**/api/complaints/42/mask', async (route) => {
    expect(route.request().postData()).toBeNull();
    const updated = calls.includes('PATCH /complaints/42');
    calls.push('POST /complaints/42/mask');
    await route.fulfill({ json: {
      complaintId: 42, contentVersion: updated ? 2 : 1, maskedContent: updated ? edited : masked,
    } });
  });

  await title.fill('');
  await editor.fill(original);
  const privacy = page.getByRole('region', { name: '개인정보 마스킹 상태', exact: true });
  const preview = privacy.locator('.privacy-masking-preview p');
  await privacy.getByText('마스킹 결과 보기', { exact: true }).click();
  await expect(privacy.getByRole('status')).toContainText('제목');
  expect(writes()).toEqual([]);
  const create = page.waitForRequest((request) => request.method() === 'POST' && new URL(request.url()).pathname === '/api/complaints');
  await title.fill('상담 일정');
  await expect(privacy.getByRole('status')).toContainText('제목 입력을 마치면');
  expect(writes()).toEqual([]);
  await editor.focus();
  expect((await create).postDataJSON().content).toBe('김서윤이 [이름]이 서윤이');
  await expect(preview).toContainText(masked);
  await expect(privacy).toContainText('3건 마스킹');
  await expect(title).not.toBeEditable();
  await expect(editor).toHaveValue(original);
  expect(writes()).toEqual(['POST /complaints', 'POST /complaints/42/mask']);

  await editor.fill('박하린 학생에게 안내해 주세요.');
  await expect(preview).toContainText(edited);
  expect(writes()).toEqual(['POST /complaints', 'POST /complaints/42/mask', 'PATCH /complaints/42', 'POST /complaints/42/mask']);

  await page.getByRole('button', { name: 'AI 분석 시작', exact: true }).click();
  await expect(page).toHaveURL(/\/review$/);
  expect(writes().slice(4)).toEqual(['POST /complaints/42/mask', 'POST /complaints/42/risk-analysis']);
  await expect(page.getByLabel('원문 내용', { exact: true })).toHaveText(edited);
  await page.getByRole('button', { name: '전송하기', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '문의를 전송할까요?', exact: true });
  await expect(dialog).toContainText(edited);
  const update = page.waitForRequest((request) => request.method() === 'PATCH' && new URL(request.url()).pathname === '/api/complaints/42');
  await dialog.getByRole('button', { name: '확인 후 전송', exact: true }).click();
  expect((await update).postDataJSON()).toEqual({ content: edited });
  await expect(page.getByRole('heading', { name: '전송 완료', exact: true })).toBeVisible();
});

test('서버가 복원한 수정안을 표시하고 분석 근거의 내부 토큰은 가린다', async ({ page }) => {
  const original = '이도윤 학생이 상담 시간을 알려 달라고 했습니다.';
  const revision = '이도윤 학생과 상담할 수 있는 시간을 안내해 주세요.';
  const evidence = '[개인정보:THIRD_PARTY_STUDENT_NAME:1] 학생이 상담 시간을 알려 달라고 했습니다.';
  await setup(page, {
    findingsResponse: {
      revisionStatus: 'COMPLETED',
      finalRevision: { content: revision, reason: '요청을 정리했습니다.' },
      findings: [{ code: 'THREAT', evidences: [evidence], revisionSuggestions: [] }],
    },
    detector: { ...detector, results: [{ ...detector.results[0], llm: {
      state: 'BOUNDARY', confidence: 0.65, evidenceSpans: [{ text: evidence, start: 0, end: evidence.length }],
    } }] },
  });
  await page.route('**/api/complaints/42/mask', async (route) => {
    await expect(page.getByRole('region', { name: '메시지 분석 중', exact: true })).toContainText(
      'AI 분석 전 학생명, 교사명, 같은 학급의 제3자 학생명, 전화번호, 이메일, 주민등록번호, 학번, 교직원번호를 가린 문장을 사용합니다.',
    );
    await route.fulfill({ json: {
      complaintId: 42, contentVersion: 1, maskedContent: '[제3자 학생명] 학생이 상담 시간을 알려 달라고 했습니다.',
    } });
  });
  await page.getByLabel('문의 내용', { exact: true }).fill(original);
  await page.getByRole('button', { name: 'AI 분석 시작', exact: true }).click();
  await expect(page.getByLabel('AI 초안 내용', { exact: true })).toHaveValue(revision);

  await page.getByRole('tab', { name: '원문', exact: true }).click();
  await expect(page.getByLabel('원문 내용', { exact: true }).locator('mark')).toContainText('[제3자 학생명]');
  const results = page.getByRole('region', { name: '위험 분석 결과', exact: true });
  await results.getByRole('button', { name: '상세 탐지 결과 더보기', exact: true }).click();
  await results.getByRole('button', { name: '서버에서 관리하는 협박 명칭 경계', exact: true }).click();
  await expect(results.locator('blockquote')).toContainText('[제3자 학생명]');
  await expect(page.locator('main')).not.toContainText('[개인정보:');
});

test('완료 응답의 수정안에 내부 토큰이 남으면 기존 수정안 실패 상태를 표시한다', async ({ page }) => {
  await setup(page, { findingsResponse: {
    revisionStatus: 'COMPLETED',
    finalRevision: { content: '연락처는 [개인정보:PHONE:1]입니다.', reason: null },
  } });
  await analyze(page);
  await expect(page.getByRole('status', { name: 'AI 수정안 상태' })).toContainText('AI 수정안을 제공하지 못했습니다.');
  await expect(page.getByRole('tab', { name: 'AI 초안', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '전송하기', exact: true })).toBeEnabled();
});

test('작성한 이름을 미리보기와 문의 생성 및 전송 요청에서 가린다', async ({ page }) => {
  await setup(page, { noRevision: true });
  const originalTitle = 'Demo Student 상담';
  const originalBody = 'Demo Teacher 선생님, 학부모 사용자입니다. 학생 이름: 김민수. 연락처 010-1234-5678';
  await page.getByLabel('문의 제목', { exact: true }).fill(originalTitle);
  const editor = page.getByLabel('문의 내용', { exact: true });
  await editor.fill(originalBody);
  const privacy = page.getByRole('region', { name: '개인정보 마스킹 상태', exact: true });
  const preview = privacy.locator('.privacy-masking-preview p');
  const createRequest = page.waitForRequest((request) =>
    request.method() === 'POST' && new URL(request.url()).pathname === '/api/complaints');
  await privacy.getByText('마스킹 결과 보기', { exact: true }).click();
  await expect(privacy).toContainText('5건 마스킹');
  await expect(preview).toContainText('제목: [이름] 상담');
  await expect(preview).toContainText('[이름] 선생님, [이름]입니다. 학생 이름: [이름]. 연락처 [전화번호]');
  await expect(editor).toHaveValue(originalBody);

  expect((await createRequest).postDataJSON()).toEqual({
    studentId: 10, teacherId: 20, title: '[이름] 상담',
    content: '[이름] 선생님, [이름]입니다. 학생 이름: [이름]. 연락처 [전화번호]',
  });
  await page.getByRole('button', { name: 'AI 분석 시작', exact: true }).click();
  await expect(page).toHaveURL(/\/review$/);

  await page.getByRole('button', { name: '직접 수정', exact: true }).click();
  await page.getByLabel('직접 수정한 문의 내용', { exact: true }).fill('Demo Student 상담 요청입니다. 성명: 이영희');
  await page.getByRole('button', { name: '전송하기', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '문의를 전송할까요?', exact: true });
  await expect(dialog).toContainText('[이름] 상담');
  await expect(dialog).toContainText('[이름] 상담 요청입니다. 성명: [이름]');
  await expect(dialog).not.toContainText(/Demo Student|이영희/);
  const updateRequest = page.waitForRequest((request) =>
    request.method() === 'PATCH' && new URL(request.url()).pathname === '/api/complaints/42');
  await dialog.getByRole('button', { name: '확인 후 전송', exact: true }).click();
  expect((await updateRequest).postDataJSON()).toEqual({ content: '[이름] 상담 요청입니다. 성명: [이름]' });
  await expect(page.getByRole('heading', { name: '전송 완료', exact: true })).toBeVisible();
});

test('성을 뺀 자녀 이름을 제목과 본문의 미리보기·저장·전송에서 가린다', async ({ page }) => {
  const calls = await setup(page, { studentName: '이도윤', noRevision: true });
  const title = page.getByLabel('문의 제목', { exact: true });
  const editor = page.getByLabel('문의 내용', { exact: true });
  await title.fill('');
  await editor.fill('이도윤 학생이 먼저 연락합니다.');
  const privacy = page.getByRole('region', { name: '개인정보 마스킹 상태', exact: true });
  await privacy.getByText('마스킹 결과 보기', { exact: true }).click();
  const preview = privacy.locator('.privacy-masking-preview p');
  await expect(preview).toContainText('내용: [이름] 학생이 먼저 연락합니다.');
  await editor.fill('도윤이 지금 010-1234-5678로 연락할 수 있습니다.');
  await expect(preview).toContainText('내용: [이름]이 지금 [전화번호]로 연락할 수 있습니다.');
  await expect(privacy).toContainText('2건 마스킹');
  await expect(privacy.getByRole('button', { name: '초안 저장하고 마스킹 확인' })).toHaveCount(0);
  await expect(title).toBeEditable();
  await expect(page.getByLabel('자녀', { exact: true })).toBeEnabled();
  await expect(page.getByLabel('문의 대상', { exact: true })).toBeEnabled();
  expect(calls.filter((call) => /^(POST|PATCH) \/complaints/.test(call))).toEqual([]);
  await privacy.getByText('마스킹 결과 보기', { exact: true }).click();
  await expect(privacy.locator('details')).not.toHaveAttribute('open');
  await title.fill('도윤');

  const create = page.waitForRequest((request) => request.method() === 'POST' && new URL(request.url()).pathname === '/api/complaints');
  await page.getByRole('button', { name: 'AI 분석 시작', exact: true }).click();
  expect((await create).postDataJSON()).toEqual({
    studentId: 10, teacherId: 20, title: '[이름]', content: '[이름]이 지금 [전화번호]로 연락할 수 있습니다.',
  });
  await expect(page).toHaveURL(/\/review$/);

  await page.getByRole('button', { name: '직접 수정', exact: true }).click();
  await page.getByLabel('직접 수정한 문의 내용', { exact: true }).fill('도윤만 참석할 예정입니다.');
  await page.getByRole('button', { name: '전송하기', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '문의를 전송할까요?', exact: true });
  await expect(dialog).toContainText('[이름]만 참석할 예정입니다.');
  const update = page.waitForRequest((request) => request.method() === 'PATCH' && new URL(request.url()).pathname === '/api/complaints/42');
  await dialog.getByRole('button', { name: '확인 후 전송', exact: true }).click();
  expect((await update).postDataJSON()).toEqual({ content: '[이름]만 참석할 예정입니다.' });
  await expect(page.getByRole('heading', { name: '전송 완료', exact: true })).toBeVisible();
});

test('이미 서버에 저장한 제목의 개인정보와 전송될 제목을 확인창에 표시한다', async ({ page }) => {
  await setup(page, { noRevision: true });
  const title = 'Demo Student 상담';
  await page.evaluate((storedTitle) => {
    const content = '상담 시간을 알려 주세요.';
    localStorage.setItem('teacher-hub.parent-message-draft.101', JSON.stringify({
      messageId: 'legacy-title', teacherId: '20', studentName: 'Demo Student',
      title: storedTitle, body: content, status: 'PARENT_REVIEW',
      server: { complaintId: 42, studentId: 10, teacherId: 20, teacherName: 'Demo Teacher',
        title: storedTitle, content, analysisId: 7 },
    }));
  }, title);
  await page.goto('/parent/messages/legacy-title/review');
  await page.getByRole('button', { name: '전송하기', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '문의를 전송할까요?', exact: true });
  await expect(dialog).toContainText(title);
  await expect(dialog).toContainText('제목에서 개인정보를 가리려면 새 문의를 작성해 주세요.');
  await expect(dialog).not.toContainText('개인정보 1건을 가린 문장으로 전송합니다.');
});

test('추가 문의 확인창은 이전 초안에 가려진 제목이 있어도 기존 문의 제목을 표시한다', async ({ page }) => {
  await setup(page, { followUp: true, noRevision: true });
  const title = 'Demo Student 상담 010-1234-5678';
  await page.evaluate((storedTitle) => {
    const content = '상담 시간을 알려 주세요.';
    localStorage.setItem('teacher-hub.parent-message-draft.101', JSON.stringify({
      messageId: 'legacy-follow-up-title', teacherId: '20', studentName: 'Demo Student', threadId: 'thread-local',
      title: storedTitle, body: content, status: 'PARENT_REVIEW',
      server: { complaintId: 42, serverMessageId: 101, teacherId: 20, teacherName: 'Demo Teacher',
        title: 'Demo Student 상담 [전화번호]', content, analysisId: 8 },
    }));
  }, title);
  await page.goto('/parent/messages/legacy-follow-up-title/review');
  await page.getByRole('button', { name: '전송하기', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '문의를 전송할까요?', exact: true });
  await expect(dialog).toContainText(title);
  await expect(dialog).toContainText('제목에서 개인정보를 가리려면 새 문의를 작성해 주세요.');
  await expect(dialog).not.toContainText('건을 가린 문장으로 전송합니다.');
});

test('기존 검토 초안에 자녀 이름이 없으면 조회 후 이름을 가린 확인창을 표시한다', async ({ page }) => {
  await setup(page, { noRevision: true });
  let finishLookup!: () => void;
  const lookup = new Promise<void>((resolve) => { finishLookup = resolve; });
  await page.route('**/api/users/me', async (route) => { await lookup; await route.fallback(); });
  await page.evaluate(() => {
    const content = 'Demo Student 상담을 요청합니다.';
    localStorage.setItem('teacher-hub.parent-message-draft.101', JSON.stringify({
      messageId: 'legacy-child-review', teacherId: '20', title: '기존 초안', body: content, status: 'PARENT_REVIEW',
      server: { complaintId: 42, studentId: 10, teacherId: 20, teacherName: 'Demo Teacher', title: '기존 초안', content, analysisId: 7 },
    }));
  });
  await page.goto('/parent/messages/legacy-child-review/review');
  const send = page.getByRole('button', { name: '전송하기', exact: true });
  try {
    await expect(send).toBeDisabled();
    await expect(page.getByRole('button', { name: '임시저장', exact: true })).toBeDisabled();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('teacher-hub.parent-message-draft.101')!).review)).toBeUndefined();
  } finally {
    finishLookup();
  }
  await send.click();
  const dialog = page.getByRole('dialog', { name: '문의를 전송할까요?', exact: true });
  await expect(dialog).toContainText('[이름] 상담을 요청합니다.');
  await expect(dialog).not.toContainText('Demo Student');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('teacher-hub.parent-message-draft.101')!).studentName)).toBe('Demo Student');
});

test('통합 카드의 상세 아코디언은 키보드로 열리고 내부 펼침 상태를 보존한다', async ({ page }, testInfo) => {
  await setup(page, { summary: { aiAnalysisStatus: 'COMPLETED', riskLevel: 'EMERGENCY' } });
  await analyze(page);
  const card = page.getByRole('region', { name: '위험 분석 결과', exact: true });
  await expect(card.getByRole('heading', { name: 'AI 분석 결과', exact: true })).toBeVisible();
  await expect(card.locator('.parent-review-analysis-header').getByRole('status')).toHaveText('분석 완료');
  await expect(card.locator('.parent-review-risk-notice')).toBeVisible();
  await expect(card.getByRole('region', { name: '개인정보 마스킹 상태' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: '개인정보 마스킹 상태' })).toBeVisible();
  const trigger = card.getByRole('button', { name: '상세 탐지 결과 더보기', exact: true });
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await trigger.focus();
  await page.keyboard.press('Enter');
  const close = card.getByRole('button', { name: '상세 탐지 결과 접기', exact: true });
  await expect(close).toHaveAttribute('aria-expanded', 'true');
  const detectorTrigger = card.getByRole('button', { name: '서버에서 관리하는 협박 명칭 경계', exact: true });
  await expect(detectorTrigger.locator('.ui-accordion-icon')).toHaveCSS('transform', 'none');
  await detectorTrigger.click();
  await expect(detectorTrigger).toHaveAttribute('aria-expanded', 'true');
  await expect(card).toContainText('신뢰도: 65%');
  await close.click();
  await trigger.click();
  await expect(detectorTrigger).toHaveAttribute('aria-expanded', 'true');
  const heading = await card.locator('.parent-review-analysis-header h2').boundingBox();
  const status = await card.locator('.parent-review-analysis-status').boundingBox();
  expect(status!.x).toBeGreaterThanOrEqual(heading!.x + heading!.width);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('integrated-analysis-card.png'), fullPage: true });
});

test('입력창 아래 안내 툴팁은 포커스·터치·Escape·외부 클릭을 지원하고 글자 수는 오른쪽에 표시된다', async ({ page, isMobile }) => {
  await setup(page);
  await analyze(page);
  const info = page.getByRole('button', { name: 'AI 분석 참고 안내', exact: true });
  const tooltip = page.getByRole('tooltip');
  await expect(page.locator('.ai-judgment-notice')).toHaveCount(0);
  await expect(tooltip).toHaveCount(0);
  const hint = await page.locator('.parent-review-hint').boundingBox();
  const count = await page.locator('.parent-review-character-count').boundingBox();
  expect(count!.x).toBeGreaterThanOrEqual(hint!.x + hint!.width);
  const infoBounds = await info.boundingBox();
  expect(Math.abs(infoBounds!.y + infoBounds!.height / 2 - hint!.y - hint!.height / 2)).toBeLessThan(1);
  await info.focus();
  await expect(tooltip).toHaveText('AI 분석은 참고용이며 오류가 있을 수 있습니다. 최종 전송 내용을 직접 확인해 주세요.');
  await expect(info).toHaveAttribute('aria-describedby', await tooltip.getAttribute('id') as string);
  await page.keyboard.press('Escape');
  await expect(tooltip).toHaveCount(0);
  await page.getByRole('heading', { name: '새 문의 작성', exact: true }).click();
  if (isMobile) await info.tap(); else await info.hover();
  await expect(tooltip).toBeVisible();
  const bounds = await tooltip.boundingBox();
  const viewport = page.viewportSize()!;
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
  await page.getByRole('heading', { name: '새 문의 작성', exact: true }).click();
  await expect(tooltip).toHaveCount(0);
});

for (const [riskLevel, label, message] of [
  ['LOW', '일반', '분석된 내용을 확인해 주세요.'],
  ['MEDIUM', '주의', '상대방에게 부담을 줄 수 있는 표현이 있어요.'],
  ['HIGH', '위험', '상대방에게 위협이나 상처가 될 수 있는 표현이 있어요.'],
  ['EMERGENCY', '긴급', '안전과 관련해 긴급히 확인할 내용이 있어요.'],
] as const) {
  test(`${riskLevel}: 단일 위험 안내와 작은 완료 상태만 표시한다`, async ({ page }, testInfo) => {
    await setup(page, { noRevision: true, summary: { riskLevel, aiAnalysisStatus: 'COMPLETED',
      analysisMessage: 'AI 위험 분석이 완료되었습니다.' }, detector: { analysisId: 7, results: [], llm: null,
      safetyFlags: { credibleThreat: false, studentSafetyConcern: false, privacyExposure: false } } });
    await analyze(page);
    const notice = page.locator('.parent-review-risk-notice');
    await expect(notice).toHaveCount(1);
    await expect(notice.locator('.ui-badge')).toHaveText(label);
    await expect(notice).toContainText(message);
    await expect(page.locator('.parent-review-analysis-header').getByRole('status')).toHaveText('분석 완료');
    await expect(page.getByText('AI 분석 완료', { exact: true })).toHaveCount(0);
    await expect(page.getByText('AI 위험 분석이 완료되었습니다.', { exact: true })).toHaveCount(0);
    await expect(page.locator('.parent-review-main .ai-judgment-notice')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'AI 분석 참고 안내', exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'AI 초안', exact: true })).toBeDisabled();
    await expect(page.locator('.parent-review-risk-accordion')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '전송하기', exact: true })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`review-${riskLevel}.png`), fullPage: true });
  });
}

test('반복 민원 미확인과 미탐지를 상세에서 구분하고 개발 정보는 숨긴다', async ({ page }) => {
  await setup(page, { detector: { analysisId: 7, llm: { modelName: 'claude-sonnet-4-6', temperature: 0 }, results: [
    { code: 'REPEAT', finalState: 'UNKNOWN', rule: null, llm: null },
    { code: 'THREAT', finalState: 'ABSENT', rule: null, llm: null },
  ] } });
  await analyze(page);
  const details = page.getByRole('region', { name: '위험 분석 결과' });
  await expect(details.getByRole('button', { name: /미확인/ })).toBeHidden();
  await details.getByText('상세 탐지 결과').click();
  await expect(details.getByRole('button', { name: /반복.*미확인/ })).toBeVisible();
  await expect(details.getByRole('button', { name: /협박.*미탐지/ })).toBeVisible();
  await expect(details).not.toContainText('분석 모델');
  await expect(details).not.toContainText('claude-sonnet');
});

test('긴 위험 표현과 여러 아코디언은 모바일에서도 줄바꿈되고 키보드로 근거를 확인한다', async ({ page }, testInfo) => {
  const excerpt = '긴위험표현'.repeat(50);
  const explanation = '서버에서 제공한 개별 판단 근거입니다.';
  await setup(page, { findingsResponse: { findings: [
    { code: 'THREAT', evidences: [excerpt, '다른 위험 표현'], revisionSuggestions: [
      { originalExpression: excerpt, suggestedExpression: '상담을 요청합니다.', reason: explanation },
    ] },
  ] } });
  await page.getByLabel('문의 내용', { exact: true }).fill(`${excerpt}\n다른 위험 표현\n${'일반 문장입니다. '.repeat(250)}`);
  await page.getByRole('button', { name: 'AI 분석 시작', exact: true }).click();
  await expect(page).toHaveURL(/\/review$/);
  await page.getByRole('tab', { name: '원문', exact: true }).click();
  await expect(page.getByRole('heading', { name: '탐지된 위험 표현 목록 (2)' })).toBeVisible();
  const trigger = page.locator('.parent-review-risk-accordion .ui-accordion-trigger').first();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger.locator('.ui-badge')).toBeVisible();
  await expect(trigger.locator('mark')).toHaveText(`"${excerpt}"`);
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.parent-review-risk-accordion .ui-accordion-panel')).toContainText(explanation);
  expect(await page.locator('.parent-review-original').evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('review-long-expressions.png'), fullPage: true });
});

test('findings 조회 실패는 완료된 위험 분석과 긴급 경고를 변경하지 않는다', async ({ page }) => {
  await setup(page, { summary: { aiAnalysisStatus: 'COMPLETED', riskLevel: 'EMERGENCY' } });
  await page.route('**/risk-analyses/7/findings', (route) => route.fulfill({ status: 500, json: { code: 'INTERNAL_SERVER_ERROR' } }));
  await analyze(page);
  await expect(page.locator('.parent-review-analysis-header').getByRole('status')).toHaveText('분석 완료');
  await expect(page.getByText('분석 결과 일부를 불러오지 못했습니다. 아래는 이미 확인된 위험 정보입니다.', { exact: true })).toBeVisible();
  await expect(page.getByText('AI 분석 완료', { exact: true })).toHaveCount(0);
  await expect(page.locator('.parent-review-risk-notice')).toContainText('긴급');
  await expect(page.getByRole('tab', { name: 'AI 초안', exact: true })).toBeDisabled();
  // A restored draft may have no successful summary at all; do not invent a prior result.
  await page.evaluate(() => {
    const key = 'teacher-hub.parent-message-draft.101';
    const draft = JSON.parse(localStorage.getItem(key)!);
    delete draft.review.analysis.riskSummary;
    localStorage.setItem(key, JSON.stringify(draft));
  });
  await page.reload();
  await expect(page.locator('.parent-review-analysis-header').getByRole('status')).toHaveText('분석 실패');
  await expect(page.getByText('분석 결과를 불러오지 못했습니다. 원문을 확인해 주세요.', { exact: true })).toBeVisible();
  await expect(page.locator('.parent-review-risk-notice')).toHaveCount(0);
});

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

test('기존 초안은 자녀 이름 조회 중과 실패 상태에서 저장·분석을 막고 재시도 후 마스킹한다', async ({ page }) => {
  const calls = await setup(page, { noRevision: true });
  let failChildren = true;
  let finishLookup!: () => void;
  const lookup = new Promise<void>((resolve) => { finishLookup = resolve; });
  await page.route((url) => url.pathname === '/api/users/me', async (route) => {
    await lookup;
    return failChildren ? route.fulfill({ status: 503, json: { code: 'INTERNAL_SERVER_ERROR' } })
      : route.fulfill({ json: { userId: 101, email: 'parent@example.com', name: '학부모', role: 'PARENT', students: [
      { studentId: 10, name: '김하나', studentNo: '1' }, { studentId: 11, name: '김두리', studentNo: '2' },
    ] } });
  });
  await page.evaluate(() => localStorage.setItem('teacher-hub.parent-message-draft.101', JSON.stringify({
    messageId: 'legacy-child-draft', teacherId: '20', title: '기존 초안', body: '작성한 문의입니다.', status: 'DRAFT',
    server: { complaintId: 42, studentId: 11, teacherId: 20, teacherName: 'Demo Teacher',
      title: '기존 초안', content: '작성한 문의입니다.', analysisId: null },
  })));
  await page.goto('/parent/messages/new?draft=legacy-child-draft');
  const child = page.getByLabel('자녀', { exact: true });
  const save = page.getByRole('button', { name: '임시저장', exact: true });
  const analyzeButton = page.getByRole('button', { name: 'AI 분석 시작', exact: true });
  await page.getByLabel('문의 내용', { exact: true }).fill('김두리 학생 상담을 요청합니다.');
  try {
    await expect(save).toBeDisabled();
    await expect(analyzeButton).toBeDisabled();
    await page.locator('.parent-write-form').evaluate((form: HTMLFormElement) => form.requestSubmit());
    expect(calls).not.toContain('PATCH /complaints/42');
  } finally {
    finishLookup();
  }
  await expect(child).toBeDisabled();
  const retry = page.locator('#parent-message-studentId-helper').getByRole('button', { name: '다시 시도', exact: true });
  await expect(retry).toBeVisible();
  await expect(save).toBeDisabled();
  await expect(analyzeButton).toBeDisabled();
  failChildren = false;
  await retry.click();
  await expect(child.locator('option:checked')).toHaveText('김두리');
  await expect(child).toHaveValue('11');
  await expect(child).toBeDisabled();
  await expect(page.getByLabel('문의 대상', { exact: true })).toBeDisabled();
  await expect(page.getByLabel('문의 제목', { exact: true })).toHaveAttribute('readonly', '');
  await save.click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('teacher-hub.parent-message-draft.101')!).studentName)).toBe('김두리');
  const update = page.waitForRequest((request) => request.method() === 'PATCH' && new URL(request.url()).pathname === '/api/complaints/42');
  await analyzeButton.click();
  expect((await update).postDataJSON()).toEqual({ content: '[이름] 학생 상담을 요청합니다.' });
  await expect(page).toHaveURL(/\/review$/);
});

test('비동기 수정안이 도착해도 원문에서 작성한 내용과 선택한 탭을 유지한다', async ({ page }) => {
  await setup(page, { summary: { aiAnalysisStatus: 'COMPLETED' } });
  let revisionReady = false;
  await page.route((url) => url.pathname === '/api/risk-analyses/7/findings', (route) => route.fulfill({ json: {
    revisionStatus: revisionReady ? 'COMPLETED' : 'PENDING', findings: [],
    finalRevision: revisionReady ? { content: '늦게 준비된 AI 수정안입니다.', reason: '표현을 다듬었습니다.' } : null,
  } }));
  await analyze(page);
  await expect(page.getByText('AI 수정안을 준비하고 있습니다.', { exact: false })).toBeVisible();
  await expect(page.locator('.parent-review-analysis-header').getByRole('status')).toHaveText('분석 완료');
  await expect(page.getByRole('tab', { name: 'AI 초안', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '직접 수정', exact: true }).click();
  const original = page.getByLabel('직접 수정한 문의 내용', { exact: true });
  await original.fill('원문을 확인하며 직접 작성한 문장입니다.');
  revisionReady = true;
  await expect(page.getByRole('tab', { name: 'AI 초안', exact: true })).toBeEnabled({ timeout: 10_000 });
  await expect(page.locator('.parent-review-analysis-header').getByRole('status')).toHaveText('분석 완료');
  await expect(page.getByRole('tab', { name: '원문', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(original).toHaveValue('원문을 확인하며 직접 작성한 문장입니다.');
  await page.getByRole('tab', { name: 'AI 초안', exact: true }).click();
  await expect(page.getByLabel('AI 초안 내용', { exact: true })).toHaveValue('늦게 준비된 AI 수정안입니다.');
  await page.reload();
  await expect(page.getByRole('tab', { name: 'AI 초안', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByLabel('AI 초안 내용', { exact: true })).toHaveValue('늦게 준비된 AI 수정안입니다.');
  await page.getByRole('tab', { name: '원문', exact: true }).click();
  await expect(original).toHaveValue('원문을 확인하며 직접 작성한 문장입니다.');
});

for (const [status, message] of [
  ['PENDING', 'AI 수정안을 준비하고 있습니다.'],
  ['COMPLETED', 'AI 수정안이 준비되었습니다.'],
  ['UNAVAILABLE', 'AI 수정안을 제공하지 못했습니다.'],
  ['NOT_REQUESTED', '이번 분석에서는 AI 수정안을 생성하지 않았습니다.'],
] as const) {
  test(`수정안 상태 ${status}와 완료된 위험 분석을 별도로 표시한다`, async ({ page }) => {
    const calls = await setup(page, { summary: { aiAnalysisStatus: 'COMPLETED' }, findingsResponse: {
      revisionStatus: status,
      // Non-completed responses must not revive stale output even if it is present in the payload.
      finalRevision: { content: '서버 수정안입니다.', reason: '요청 정리' },
    } });
    await analyze(page);
    await expect(page.getByRole('status', { name: 'AI 수정안 상태' })).toContainText(message);
    await expect(page.locator('.parent-review-analysis-header').getByRole('status')).toHaveText('분석 완료');
    await expect(page.getByRole('tab', { name: 'AI 초안', exact: true })).toBeEnabled({ enabled: status === 'COMPLETED' });
    await expect.poll(() => calls.filter((call) => call === 'GET /risk-analyses/7/findings').length).toBeGreaterThanOrEqual(2);
    expect(calls.filter((call) => call === 'POST /complaints/42/risk-analysis')).toHaveLength(1);
  });
}

for (const initialStatus of ['PENDING', 'UNAVAILABLE', 'NOT_REQUESTED', 'COMPLETED', undefined] as const) {
  test(`저장된 ${initialStatus ?? '상태 없음'} 수정안을 재진입 시 조회하고 원문 편집과 선택을 보존한다`, async ({ page }) => {
    const findings: Partial<RiskRevisionResponse> = {
      revisionStatus: initialStatus,
      finalRevision: initialStatus === 'COMPLETED' ? { content: '이전에 받은 수정안입니다.', reason: '이전 이유' } : null,
    };
    const calls = await setup(page, { findingsResponse: findings, summary: { aiAnalysisStatus: 'COMPLETED' } });
    await analyze(page);
    const reviewUrl = page.url();
    await expect.poll(() => calls.filter((call) => call === 'GET /risk-analyses/7/findings').length).toBeGreaterThanOrEqual(2);
    await page.getByRole('tab', { name: '원문', exact: true }).click();
    await page.getByRole('button', { name: '직접 수정', exact: true }).click();
    await page.getByLabel('직접 수정한 문의 내용', { exact: true }).fill('사용자가 보존하려는 원문 편집입니다.');
    await page.getByRole('button', { name: '문의 작성으로 돌아가기', exact: true }).click();
    findings.revisionStatus = 'COMPLETED';
    findings.finalRevision = { content: '재진입하여 받은 최신 수정안입니다.', reason: '최신 이유' };
    await page.goto(reviewUrl);
    await expect(page.getByRole('status', { name: 'AI 수정안 상태' })).toContainText('AI 수정안이 준비되었습니다.');
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('teacher-hub.parent-message-draft.101')!).review.analysis.revisedText))
      .toBe(findings.finalRevision.content);
    await expect(page.getByRole('tab', { name: '원문', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByLabel('직접 수정한 문의 내용', { exact: true })).toHaveValue('사용자가 보존하려는 원문 편집입니다.');
    await page.getByRole('tab', { name: 'AI 초안', exact: true }).click();
    await expect(page.getByLabel('AI 초안 내용', { exact: true })).toHaveValue(findings.finalRevision.content);
    expect(calls.filter((call) => call.includes('risk-analysis') && call.startsWith('POST'))).toHaveLength(1);
  });
}

test('PENDING 자동 조회 15회 종료는 실패가 아니며 수동 확인은 같은 분석만 조회한다', async ({ page }) => {
  const findings: Partial<RiskRevisionResponse> = { revisionStatus: 'PENDING', finalRevision: null };
  const calls = await setup(page, { findingsResponse: findings, summary: { aiAnalysisStatus: 'COMPLETED' } });
  await page.clock.install({ time: new Date('2026-11-23T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-11-23T00:00:01Z'));
  await analyze(page);
  const lookupCount = () => calls.filter((call) => call === 'GET /risk-analyses/7/findings').length;
  await expect.poll(lookupCount).toBeGreaterThanOrEqual(2);
  await expect(page.getByText('AI 수정안의 최신 상태를 확인하고 있습니다.', { exact: true })).toHaveCount(0);
  // StrictMode may start and abort an extra entry lookup; count the 14 scheduled polls separately.
  const entryLookups = lookupCount();
  for (let poll = 0; poll < 14; poll += 1) {
    const evidence = `자동 조회 ${poll + 1}의 위험 근거`;
    findings.findings = [{ code: 'THREAT', evidences: [evidence], revisionSuggestions: [] }];
    await page.clock.runFor(2100);
    await expect.poll(lookupCount).toBe(entryLookups + poll + 1);
    // Wait for JSON conversion/state persistence before advancing the next response-relative timer.
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('teacher-hub.parent-message-draft.101')!).review.analysis.risks[0]?.excerpt))
      .toBe(evidence);
  }
  const notice = page.getByRole('status', { name: 'AI 수정안 상태' });
  await expect(notice).toContainText('마지막 확인 시 AI 수정안을 생성 중이었습니다.');
  await expect(notice).toContainText('자동 조회가 종료되었습니다.');
  await expect(notice).not.toContainText('제공하지 못했습니다');
  await expect(page.locator('.parent-review-analysis-header').getByRole('status')).toHaveText('분석 완료');
  await page.clock.runFor(20_000);
  expect(lookupCount()).toBe(entryLookups + 14);
  findings.revisionStatus = 'COMPLETED';
  findings.finalRevision = { content: '자동 조회 종료 후 완성된 수정안입니다.', reason: '완료' };
  await page.getByRole('button', { name: '수정안 다시 확인', exact: true }).click();
  await expect(notice).toContainText('AI 수정안이 준비되었습니다.');
  await expect(notice).not.toContainText('자동 조회가 종료되었습니다.');
  expect(lookupCount()).toBe(entryLookups + 15);
  expect(calls.filter((call) => call.includes('risk-analysis') && call.startsWith('POST'))).toHaveLength(1);
});

test('COMPLETED 분석의 최초 findings 조회 실패도 재분석 없이 복구한다', async ({ page }) => {
  const calls = await setup(page, { summary: { revisionStatus: 'COMPLETED', aiAnalysisStatus: 'COMPLETED' },
    findingsResponse: { revisionStatus: 'COMPLETED' } });
  let failing = true;
  await page.route('**/risk-analyses/7/findings', (route) => failing
    ? route.fulfill({ status: 503, json: { code: 'INTERNAL_SERVER_ERROR' } }) : route.fallback());
  await analyze(page);
  const notice = page.getByRole('status', { name: 'AI 수정안 상태' });
  await expect(notice).toContainText('AI 수정안 생성은 완료되었지만 수정안 내용을 불러오지 못했습니다.');
  await expect(notice).toContainText('현재 상태를 조회하지 못했습니다.');
  await expect(page.locator('.parent-review-analysis-header').getByRole('status')).toHaveText('분석 완료');
  failing = false;
  await page.getByRole('button', { name: '수정안 다시 확인', exact: true }).click();
  await expect(notice).toContainText('AI 수정안이 준비되었습니다.');
  await expect(notice).not.toContainText('조회하지 못했습니다');
  await expect(page.getByRole('tab', { name: 'AI 초안', exact: true })).toBeEnabled();
  expect(calls.filter((call) => call.includes('risk-analysis') && call.startsWith('POST'))).toHaveLength(1);
});

for (const edited of ['직접 편집한 AI 문장입니다.', '']) {
  test(`재조회 실패와 늦은 완료 후에도 AI 편집${edited ? ' 문장' : '기의 빈 내용'}과 선택을 보존한다`, async ({ page }) => {
    const findings: Partial<RiskRevisionResponse> = { revisionStatus: 'COMPLETED' };
    const calls = await setup(page, { finding: true, findingsResponse: findings, summary: { aiAnalysisStatus: 'COMPLETED' } });
    await analyze(page);
    const editor = page.getByLabel('AI 초안 내용', { exact: true });
    await expect(editor).toBeVisible();
    await editor.fill(edited);
    await page.getByRole('tab', { name: '원문', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'AI 초안', exact: true })).toBeEnabled();
    await page.getByRole('tab', { name: 'AI 초안', exact: true }).click();
    await expect(editor).toHaveValue(edited);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('teacher-hub.parent-message-draft.101')!).review.aiText)).toBe(edited);
    let failing = true;
    await page.route('**/risk-analyses/7/findings', (route) => failing ? route.abort('failed') : route.fallback());
    await page.reload();
    const notice = page.getByRole('status', { name: 'AI 수정안 상태' });
    await expect(notice).toContainText('현재 상태를 조회하지 못했습니다.');
    await expect(editor).toHaveValue(edited);
    await expect(page.getByRole('tab', { name: 'AI 초안', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.parent-review-analysis-header').getByRole('status')).toHaveText('분석 완료');
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('teacher-hub.parent-message-draft.101')!).review.analysis.risks.length)).toBe(1);
    failing = false;
    findings.finalRevision = { content: '서버에서 새로 확인한 수정안입니다.', reason: '최신 이유' };
    await page.getByRole('button', { name: '수정안 다시 확인', exact: true }).click();
    await expect(notice).not.toContainText('조회하지 못했습니다');
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('teacher-hub.parent-message-draft.101')!).review.analysis.revisedText)).toBe(findings.finalRevision.content);
    await expect(editor).toHaveValue(edited);
    await page.reload();
    await expect(editor).toHaveValue(edited);
    await expect(page.getByRole('tab', { name: 'AI 초안', exact: true })).toHaveAttribute('aria-selected', 'true');
    expect(calls.filter((call) => call.includes('risk-analysis') && call.startsWith('POST'))).toHaveLength(1);
  });
}

test('재조회한 UNAVAILABLE을 숨기지 않고 기존 AI 편집 문장을 보존한다', async ({ page }) => {
  const findings: Partial<RiskRevisionResponse> = { revisionStatus: 'COMPLETED' };
  await setup(page, { findingsResponse: findings });
  await analyze(page);
  await page.getByLabel('AI 초안 내용', { exact: true }).fill('이미 편집한 문장입니다.');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('teacher-hub.parent-message-draft.101')!).review.aiText)).toBe('이미 편집한 문장입니다.');
  findings.revisionStatus = 'UNAVAILABLE';
  findings.finalRevision = null;
  await page.reload();
  const notice = page.getByRole('status', { name: 'AI 수정안 상태' });
  await expect(notice).toContainText('AI 수정안을 제공하지 못했습니다.');
  await expect(notice).toContainText('이전에 확인하거나 수정한 내용입니다.');
  await expect(page.getByLabel('AI 초안 내용', { exact: true })).toHaveValue('이미 편집한 문장입니다.');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('teacher-hub.parent-message-draft.101')!).review.analysis.revisionStatus)).toBe('UNAVAILABLE');
  await page.reload();
  await expect(notice).toContainText('AI 수정안을 제공하지 못했습니다.');
  await expect(page.getByLabel('AI 초안 내용', { exact: true })).toHaveValue('이미 편집한 문장입니다.');
});

test('진입 조회 응답을 기다리는 동안 입력한 AI 문장을 늦은 응답이 덮어쓰지 않는다', async ({ page }) => {
  await setup(page, { findingsResponse: { revisionStatus: 'COMPLETED' } });
  await analyze(page);
  await expect(page.getByText('AI 수정안의 최신 상태를 확인하고 있습니다.', { exact: true })).toHaveCount(0);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/risk-analyses/7/findings', async (route) => {
    await gate;
    await route.fulfill({ json: { revisionStatus: 'COMPLETED', findings: [],
      finalRevision: { content: '늦게 조회된 서버 수정안입니다.', reason: '최신 결과' } } });
  });
  try {
    await page.reload();
    await expect(page.getByText('AI 수정안의 최신 상태를 확인하고 있습니다.', { exact: true })).toBeVisible();
    const editor = page.getByLabel('AI 초안 내용', { exact: true });
    await editor.fill('조회 응답을 기다리며 입력한 문장입니다.');
    release();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('teacher-hub.parent-message-draft.101')!).review.analysis.revisedText))
      .toBe('늦게 조회된 서버 수정안입니다.');
    await expect(editor).toHaveValue('조회 응답을 기다리며 입력한 문장입니다.');
  } finally {
    release();
  }
});

test('수정안 자동 저장 실패를 알리고 화면의 편집 내용을 임시저장으로 복구한다', async ({ page }) => {
  await setup(page, { findingsResponse: { revisionStatus: 'COMPLETED' } });
  await analyze(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    window.addEventListener('restore-draft-storage', () => { Storage.prototype.setItem = original; }, { once: true });
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('teacher-hub.parent-message-draft.')) {
        throw new DOMException('Synthetic quota failure', 'QuotaExceededError');
      }
      original.call(this, key, value);
    };
  });
  const editor = page.getByLabel('AI 초안 내용', { exact: true });
  await editor.fill('저장 실패 후에도 보존할 문장입니다.');
  await expect(page.getByRole('alert')).toContainText('최신 검토 내용을 이 기기에 저장하지 못했습니다.');
  await expect(editor).toHaveValue('저장 실패 후에도 보존할 문장입니다.');
  await page.evaluate(() => window.dispatchEvent(new Event('restore-draft-storage')));
  await page.getByRole('button', { name: '임시저장', exact: true }).click();
  await expect(page.getByText('최신 검토 내용을 이 기기에 저장하지 못했습니다.', { exact: false })).toHaveCount(0);
  await page.reload();
  await expect(editor).toHaveValue('저장 실패 후에도 보존할 문장입니다.');
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
    const draftId = await page.evaluate(() => JSON.parse(localStorage.getItem('teacher-hub.parent-message-draft.101')!).messageId);
    // New inquiry navigation is empty; explicitly resume the pending draft through history.
    await page.getByRole('navigation', { name: '현재 위치' }).getByRole('link', { name: '홈', exact: true }).click();
    await expect(page.getByLabel('문의 내용', { exact: true })).toHaveValue('');
    if (page.viewportSize()!.width <= 980) {
      await page.getByRole('button', { name: '학부모 메뉴 더보기', exact: true }).click();
      await page.getByRole('dialog', { name: 'Teacher Hub 학부모 메뉴', exact: true })
        .getByRole('link', { name: '문의 내역', exact: true }).click();
    } else {
      await page.getByRole('link', { name: '문의 내역', exact: true }).click();
    }
    await page.getByRole('tab', { name: '임시저장', exact: true }).click();
    await page.getByRole('button', { name: /HTTP 분석 확인/ }).click();
    await page.getByRole('dialog', { name: '작성 중인 문의가 있어요.', exact: true })
      .getByRole('button', { name: '이어서 작성', exact: true }).click();
    await expect(page).toHaveURL(`/parent/messages/new?draft=${draftId}`);
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
  const noticeText = `AI 분석 후 내용을 확인하고 전송할 수 있어요. ${savedDraftTooltip}`;
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
    await checkInformationTooltip(page, 'AI 분석 안내', savedDraftTooltip,
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
  await title.fill('');
  await expect(privacy).toHaveClass(/has-personal-info/);
  await expect(privacy).toContainText('1건 마스킹');
  await privacy.getByText('마스킹 결과 보기', { exact: true }).click();
  await expect(privacy.locator('.privacy-masking-preview p')).toBeVisible();
  await expect(privacy).not.toContainText('010-1234-5678');
  await privacy.getByText('마스킹 결과 보기', { exact: true }).click();
  await expect(privacy.locator('details')).not.toHaveAttribute('open');
  await title.fill('HTTP 분석 확인');
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
      await checkInformationTooltip(page, '개인정보 확인 범위', privacyScopeTooltip,
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
  await results.getByText('상세 탐지 결과', { exact: true }).click();
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

test('HTTP 검토는 위험 안내를 통합하고 개발 정보 없이 상세 근거를 펼쳐 볼 수 있다', async ({ page }) => {
  const calls = await setup(page);
  await analyze(page);
  const results = page.getByRole('region', { name: '위험 분석 결과' });
  await expect(results.locator('.parent-review-risk-notice')).toHaveCount(1);
  await expect(results).not.toContainText('위험 점수:');
  await expect(results.getByText('요청을 구체적이고 부드럽게 표현했습니다.', { exact: true })).toBeHidden();
  await results.getByText('상세 탐지 결과', { exact: true }).click();
  await expect(results).toContainText('요청을 구체적이고 부드럽게 표현했습니다.');
  await results.getByRole('button', { name: '서버에서 관리하는 협박 명칭 경계', exact: true }).click();
  await expect(results).toContainText('규칙 분석');
  await expect(results).toContainText('신뢰도: 0%');
  await expect(results).toContainText('신뢰도: 65%');
  await expect(results.getByText('상담 시간을 알려 주세요.', { exact: true })).toBeVisible();
  await expect(results).not.toContainText('test-detector');
  await expect(results).not.toContainText('생성 다양성');
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

test('교사 답변 대기 중에는 추가 문의 버튼과 작성 URL을 막는다', async ({ page }) => {
  const calls = await setup(page, { lifecycle: { status: 'OPEN', waitingFor: 'TEACHER' }, cachedAnswered: true });
  const waiting = page.getByText('선생님의 답변을 기다리고 있어요.', { exact: false });
  await expect(waiting).toBeVisible();
  await expect(page.getByRole('button', { name: '추가 문의하기', exact: true })).toHaveCount(0);

  // Reloading a direct link reseeds the older ANSWERED/PARENT browser copy.
  await page.goto('/parent/messages/thread-local/follow-up');
  await expect(page).toHaveURL(/\/parent\/messages\/thread-local$/);
  await expect(waiting).toBeVisible();
  await expect(page.getByLabel('문의 내용', { exact: true })).toHaveCount(0);
  expect(calls).toContain('GET /complaints/42');
  expect(calls.some((call) => call.endsWith('/message-draft'))).toBe(false);
});

test('기존 OPEN/PARENT 응답에서는 추가 문의 버튼으로 작성 화면을 열 수 있다', async ({ page }) => {
  const calls = await setup(page, { lifecycle: { status: 'OPEN', waitingFor: 'PARENT' } });
  await page.getByRole('button', { name: '추가 문의하기', exact: true }).click();
  await expect(page.getByLabel('문의 내용', { exact: true })).toBeEditable();
  await expect.poll(() => calls).toContain('GET /complaints/42/message-draft');
  const statusLookup = calls.indexOf('GET /complaints/42');
  expect(statusLookup).toBeGreaterThanOrEqual(0);
  expect(statusLookup).toBeLessThan(calls.indexOf('GET /complaints/42/message-draft'));
});

test('다른 기기에서도 종료된 문의의 추가 작성 URL로 바로 접근할 수 있다', async ({ page }) => {
  const calls = await setup(page, { lifecycle: { status: 'CLOSED' }, uncachedFollowUp: true });
  await expect(page).toHaveURL(/\/parent\/messages\/server-42\/follow-up$/);
  await expect(page.getByLabel('문의 제목', { exact: true })).toHaveValue(thread.title);
  await expect(page.getByLabel('문의 내용', { exact: true })).toBeEditable();
  await expect.poll(() => calls).toContain('GET /complaints/42/message-draft');
  expect(calls).not.toContain('GET /complaints/42/messages');
});

test('문의 상태 조회에 실패하면 작성 화면을 열기 전에 다시 조회할 수 있다', async ({ page }) => {
  const calls = await setup(page, { lifecycle: { status: 'ANSWERED' } });
  let detailAvailable = false;
  await page.route((url) => url.pathname === '/api/complaints/42', (route) =>
    detailAvailable ? route.fallback()
      : route.fulfill({ status: 503, json: { code: 'INTERNAL_SERVER_ERROR' } }));

  await page.getByRole('button', { name: '추가 문의하기', exact: true }).click();
  const retry = page.getByRole('alert').getByRole('button', { name: '다시 시도하기', exact: true });
  await expect(retry).toBeVisible();
  await expect(page.getByLabel('문의 내용', { exact: true })).toHaveCount(0);
  expect(calls.some((call) => call.endsWith('/message-draft'))).toBe(false);

  detailAvailable = true;
  await retry.click();
  await expect(page.getByLabel('문의 내용', { exact: true })).toBeEditable();
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
  const collapse = page.getByRole('button', { name: '추가 문의 입력창 접기', exact: true });
  await collapse.focus();
  await collapse.press('Enter');
  await expect(input).toHaveCount(0);
  await expect(page.getByRole('region', { name: '전체 대화 내역', exact: true })).toBeFocused();
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
  await page.getByText('상세 탐지 결과', { exact: true }).click();
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
    await expect(results).not.toContainText('위험 점수:');
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

const safetySignal = {
  code: 'STUDENT_SAFETY_CONCERN',
  title: '학생 안전 우려',
  description: '학생 안전 우려 신호가 확인되어 긴급 단계로 상향되었습니다.',
};
const emergencyOverride = { applied: true, safetySignals: [safetySignal] };

test('학부모 분석 POST의 긴급 승격 사유를 일반 위험 태그가 없어도 표시한다', async ({ page }) => {
  await setup(page, {
    summary: { riskLevel: 'EMERGENCY', emergencyOverride },
    detector: { analysisId: 7, llm: null, results: [{ code: 'THREAT', finalState: 'ABSENT', rule: null, llm: null }] },
  });
  await analyze(page);
  const results = page.getByRole('region', { name: '위험 분석 결과' });
  const signals = results.locator('.parent-review-risk-notice');
  await expect(signals.getByText(safetySignal.title, { exact: true })).toBeVisible();
  await expect(signals).toContainText('긴급');
  await expect(results).not.toContainText('시스템 위험도:');
  await expect(results).not.toContainText('단계로 상향');
  await results.getByText('상세 탐지 결과', { exact: true }).click();
  await expect(results.getByRole('button', { name: '서버에서 관리하는 협박 명칭 미탐지', exact: true })).toBeVisible();
  await page.reload();
  await expect(signals.getByText(safetySignal.title, { exact: true })).toBeVisible();
});

test('학부모 findings의 긴급 승격 사유와 기존 위험 태그 목록을 함께 표시한다', async ({ page }) => {
  await setup(page, {
    finding: true,
    summary: { riskLevel: 'EMERGENCY' },
    findingsResponse: { emergencyOverride },
  });
  await analyze(page);
  await page.getByRole('tab', { name: '원문', exact: true }).click();
  const signals = page.locator('.parent-review-risk-notice');
  const tags = page.getByRole('region', { name: '탐지된 위험 표현 목록 (1)', exact: true });
  await expect(signals).toContainText(safetySignal.title);
  await expect(tags).toContainText('서버에서 관리하는 협박 명칭');
  expect(await signals.evaluate((element, next) =>
    Boolean(element.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING), await tags.elementHandle())).toBe(true);
});

test('학부모 findings가 수정안 준비 중이어도 긴급 승격 사유를 먼저 표시한다', async ({ page }) => {
  await setup(page, {
    summary: { riskLevel: 'EMERGENCY' },
    findingsResponse: { revisionStatus: 'PENDING', finalRevision: null },
  });
  await analyze(page);
  await expect(page.getByText('AI 수정안을 준비하고 있습니다.', { exact: false })).toBeVisible();

  await page.route((url) => url.pathname === '/api/risk-analyses/7/findings', (route) => route.fulfill({ json: {
    revisionStatus: 'PENDING', findings: [], finalRevision: null, emergencyOverride,
  } }));
  await expect(page.locator('.parent-review-risk-notice')).toContainText(safetySignal.title, { timeout: 10_000 });
  await expect(page.getByRole('tab', { name: 'AI 초안', exact: true })).toBeDisabled();
});

for (const applied of [false, null] as const) {
  test(`학부모 findings에서 긴급 승격을 해제하면 사유 영역을 숨긴다 (${applied})`, async ({ page }) => {
    await setup(page, {
      summary: { riskLevel: 'EMERGENCY', emergencyOverride },
      findingsResponse: { emergencyOverride: applied === null ? null : { ...emergencyOverride, applied } },
      detector: { analysisId: 7, results: [], llm: null,
        safetyFlags: { credibleThreat: false, studentSafetyConcern: true, privacyExposure: false } },
    });
    await analyze(page);
    await expect(page.locator('.parent-review-risk-notice')).toContainText('학생 안전 위험');
    await expect(page.locator('.parent-review-risk-notice')).not.toContainText(safetySignal.title);
    await expect(page.getByText('긴급 안전 신호', { exact: true })).toHaveCount(0);
    await expect(page.getByText(safetySignal.description, { exact: true })).toHaveCount(0);
  });
}

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
    await expect(results.locator('.parent-review-risk-notice')).toContainText('구체적인 위해를 예고하는 표현');
    await expect(results).not.toContainText('개인정보 노출 또는 유포 위험이 감지');
    await results.getByText('상세 탐지 결과', { exact: true }).click();
    await expect(results).toContainText('학생 안전 위험: 미확인');
    await results.getByRole('button', { name: '서버에서 관리하는 협박 명칭 탐지', exact: true }).click();
    await expect(results).toContainText(`심각도: ${severity === null ? '경계 사례' : ['해당 없음', '경미', '보통', '심각'][severity]}`);
    await expect(results).toContainText(severity === null ? '반복 횟수 정보 없음' : '현재 민원에서 5회 감지');
    // Safety flags do not cause the client to recalculate the returned score or level.
    await expect(results.locator('.parent-review-risk-notice .ui-badge')).toHaveText('위험');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('teacher-hub.parent-message-draft.101')!));
    expect(saved.review.analysis.riskSummary).toMatchObject({ riskScore: 30, riskLevel: 'HIGH' });
  });
}

test('UNKNOWN과 누락된 안전 신호는 위험 없음으로 표시하지 않는다', async ({ page }) => {
  await setup(page, { detector: { analysisId: 7, llm: null, results: [
    { code: 'THREAT', finalState: 'UNKNOWN', rule: null, llm: { state: 'UNKNOWN', confidence: null } },
  ] } });
  await analyze(page);
  const results = page.getByRole('region', { name: '위험 분석 결과' });
  await results.getByText('상세 탐지 결과', { exact: true }).click();
  await expect(results).toContainText('안전 신호 정보가 제공되지 않았습니다.');
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
    await expect(page.locator('.risk-analysis-notice')).toHaveCount(0);
    await expect(page.getByText('분석 횟수 제한', { exact: true })).toHaveCount(0);
    await expect(page.getByText(/최종 전송 내용의 시스템 위험 점수/)).toHaveCount(0);
    const messages = await page.evaluate(() => JSON.parse(localStorage.getItem('teacher-hub.parent-sent-messages.101')!));
    expect(messages[0].submissionAnalysis).toMatchObject({ aiAnalysisStatus: 'SKIPPED_LIMIT' });
    expect(messages[0].submissionAnalysis.riskScore).toBeUndefined();
  });
}

test('전송 완료 화면은 분석 안내와 위험 점수를 숨기고 최종 분석 데이터는 보존한다', async ({ page }) => {
  await setup(page, { summary: { riskScore: 95 }, submission: {
    submissionAnalysisStatus: 'RULE_ONLY_INVALID_RESPONSE',
    riskAnalysis: { analysisId: 9, complaintId: 42, riskScore: 25, riskLevel: 'MEDIUM',
      aiAnalysisStatus: 'RULE_ONLY_INVALID_RESPONSE', analysisMode: 'RULE_ONLY', manualReviewRequired: true },
  } });
  await analyze(page);
  await page.getByRole('button', { name: '전송하기', exact: true }).click();
  await page.getByRole('button', { name: '확인 후 전송', exact: true }).click();
  await expect(page.getByRole('heading', { name: '전송 완료', exact: true })).toBeVisible();
  await expect(page.locator('.risk-analysis-notice')).toHaveCount(0);
  await expect(page.getByText(/최종 전송 내용의 시스템 위험 점수/)).toHaveCount(0);
  await expect(page.getByText('잠정 분석', { exact: true })).toHaveCount(0);
  await expect(page.getByText('교사의 직접 검토가 필요합니다.', { exact: true })).toHaveCount(0);
  const messages = await page.evaluate(() => JSON.parse(localStorage.getItem('teacher-hub.parent-sent-messages.101')!));
  expect(messages[0].submissionAnalysis).toMatchObject({
    aiAnalysisStatus: 'RULE_ONLY_INVALID_RESPONSE', riskScore: 25, riskLevel: 'MEDIUM', manualReviewRequired: true,
  });
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
  await page.getByText('상세 탐지 결과', { exact: true }).click();
  await page.getByRole('button', { name: '서버에서 관리하는 협박 명칭 미탐지', exact: true }).click();
  await expect(page.getByText('현재 민원에서 0회 감지', { exact: true })).toBeVisible();
});
