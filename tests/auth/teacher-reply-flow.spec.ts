import { expect, test, type Page } from '@playwright/test';

async function loginTeacher(page: Page) {
  await page.goto('/login?role=TEACHER');
  await page.locator('input[name="email"]').fill('teacher@example.com');
  await page.locator('input[name="password"]').fill('password123');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page).toHaveURL(/\/teacher(?:\/messages)?$/);
}

async function confirmSend(page: Page) {
  await page.getByRole('button', { name: '검토 후 전송', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '답변 전 확인', exact: true });
  await expect(dialog).toContainText('전송할 답변을 최종 확인해 주세요.');
  await expect(dialog.getByRole('button', { name: '최종 전송', exact: true })).toBeDisabled();
  await dialog.getByRole('checkbox', { name: '답변 내용을 확인했으며, 전송에 동의합니다.' }).check();
  // A double click must still store the reply only once.
  await dialog.getByRole('button', { name: '최종 전송', exact: true }).evaluate((element) => {
    (element as HTMLButtonElement).click();
    (element as HTMLButtonElement).click();
  });
  await expect(page.getByRole('dialog', { name: '답변 전송 완료', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '확인', exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  await loginTeacher(page);
});

for (const [level, threadId] of [['Low', 'thread-003'], ['Medium', 'thread-002']]) {
  test(`${level}는 대화를 유지한 채 답변 패널을 열고 초안을 보존한다`, async ({ page }, testInfo) => {
    await page.goto(`/teacher/messages/${threadId}`);
    const conversation = page.locator('.board-conversation');
    const message = await conversation.locator('.board-reply-bubble p, .board-moderation-card p').first().innerText();
    await page.getByRole('button', { name: /^답변 (작성|이어서 작성하기)$/ }).click();
    await expect(page.getByRole('heading', { name: '메시지 상세', exact: true })).toBeVisible();
    await expect(conversation).toContainText(message);
    await expect(page.locator('.board-inline-reply-composer .board-reply-compose-panel')).toBeVisible();
    await expect(page.locator('.board-reply-context-panel')).toHaveCount(0);
    if (level === 'Medium') {
      await expect(page.locator('.board-reply-ai-note')).toHaveText('주의 단계 · 완충 요약과 원문을 확인한 후 답변을 검토해 주세요.');
    } else {
      await expect(page.locator('.board-reply-notices')).toHaveCount(0);
    }
    await page.getByRole('tab', { name: '직접 작성', exact: true }).click();
    const editor = page.getByLabel('선생님 답변', { exact: true });
    await editor.fill('확인한 내용을 정리해서 안내드리겠습니다.');
    const tabs = page.getByRole('navigation', { name: '메시지 상세 탭' });
    await tabs.getByRole('button', { name: '처리 기록', exact: true }).click();
    await expect(editor).toBeHidden();
    await tabs.getByRole('button', { name: '대화', exact: true }).click();
    await expect(editor).toHaveValue('확인한 내용을 정리해서 안내드리겠습니다.');
    await page.goBack();
    await expect(page.locator('.board-reply-compose-panel')).toHaveCount(0);
    await page.goForward();
    // Reopening still defaults to the AI tab, while the manual tab keeps its own draft.
    await page.getByRole('tab', { name: '직접 작성', exact: true }).click();
    await expect(editor).toHaveValue('확인한 내용을 정리해서 안내드리겠습니다.');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('.board-detail').screenshot({ path: testInfo.outputPath('inline-reply.png') });
    await confirmSend(page);
    await expect(page.locator('.board-reply-teacher').last()).toContainText('확인한 내용을 정리해서 안내드리겠습니다.');
    await expect(page.locator('.board-reply-compose-panel')).toHaveCount(0);
  });
}

test('High는 고정 문장을 유지하고 선택한 안내의 빈칸만 검사한다', async ({ page }) => {
  await page.goto('/teacher/messages/thread-004/response');
  await expect(page.getByRole('tab', { name: 'AI 초안 활용', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: '직접 작성', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '공식 템플릿 적용', exact: true }).click();
  await expect(page.locator('.ai-judgment-notice--inline')).toHaveCount(0);
  const body = page.getByRole('group', { name: '답장 예시 편집', exact: true });
  await expect(body.locator('textarea')).toHaveCount(1);
  await expect(body.locator('textarea')).toHaveAttribute('maxlength', '150');
  await expect(page.getByRole('button', { name: '검토 후 전송', exact: true })).toBeDisabled();

  await page.getByRole('radio', { name: '관찰 내용은 학교 상담 창구를 통해 안내드리겠습니다.', exact: true }).check();
  await expect(page.getByLabel('상담 일시 선택', { exact: true })).toHaveCount(0);
  const edit = page.getByRole('textbox', { name: '직접 고칠 문장', exact: true });
  await edit.fill('보내주신 말씀은 반드시 확인하겠습니다.');
  await page.getByRole('button', { name: '‘다시’로 바꾸기', exact: true }).click();
  await expect(edit).toHaveValue('보내주신 말씀은 다시 확인하겠습니다.');
  await page.getByRole('textbox', { name: '보호자 호칭', exact: true }).fill('');
  await expect(page.getByRole('button', { name: '검토 후 전송', exact: true })).toBeDisabled();
  await page.getByRole('textbox', { name: '보호자 호칭', exact: true }).fill('이수아');

  // Changing the rendered DOM cannot replace the serialized fixed wording.
  await body.locator('.board-template-sentence').nth(1).evaluate((element) => { element.textContent = '임의로 바꾼 문장'; });
  await confirmSend(page);
  const reply = page.locator('.board-reply-teacher');
  await expect(reply).toContainText('학교에서는 학생 생활 관찰 기록 절차');
  await expect(reply).toContainText('관찰 내용은 학교 상담 창구를 통해 안내드리겠습니다.');
  await expect(reply).not.toContainText('임의로 바꾼 문장');
  await expect(reply).not.toContainText('[상담 일시 선택]');
});

test('규정 원문은 선택한 출처와 버전을 표시하고 작성 중인 답변을 유지한다', async ({ page }) => {
  await page.goto('/teacher/messages/thread-003/response');
  const editor = page.locator('#board-reply-composer-input');
  await editor.fill('규정 확인 후 안내드리겠습니다.');
  await page.locator('.board-reply-check-toggle').click();
  await page.getByRole('button', { name: '현장체험학습 운영 계획 자세히 보기', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '규정 원문 확인', exact: true });
  await expect(dialog).toContainText('현장체험학습 운영 계획');
  await expect(dialog).toContainText('v0.9');
  await expect(dialog).toContainText('제5조(준비물 및 안전 수칙)');
  await expect(dialog).toContainText('개인 도시락 지참');
  await expect(dialog).toContainText('실제 학교 규정이나 공식 원문이 아니며');
  await expect(dialog.getByRole('alert')).toContainText('구버전');
  await expect(dialog.getByRole('link')).toHaveCount(0);
  await expect(page).toHaveURL(/thread-003\/response$/);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(editor).toHaveValue('규정 확인 후 안내드리겠습니다.');
  await expect(page.getByRole('button', { name: '현장체험학습 운영 계획 자세히 보기', exact: true })).toBeFocused();

  await page.goto('/teacher/messages/thread-002/response');
  await page.locator('.board-reply-check-toggle').click();
  await page.getByRole('button', { name: '학교 생활지도 규정 자세히 보기', exact: true }).click();
  await expect(dialog).toContainText('제7조(학생 간 갈등 확인 절차)');
  await expect(dialog).not.toContainText('제5조(준비물 및 안전 수칙)');
});

test('High에서 맞는 예시가 없으면 AI 생성 없이 직접 작성한다', async ({ page }) => {
  await page.goto('/teacher/messages/thread-002');
  await page.getByRole('navigation', { name: '메시지 상세 탭' }).getByRole('button', { name: '위험 요소', exact: true }).click();
  await page.getByRole('button', { name: '6점 높은 위험', exact: true }).click();
  await page.getByPlaceholder('상향 수정 사유를 입력해주세요.').fill('추가 위험 표현을 확인했습니다.');
  await page.getByRole('button', { name: '상향 반영', exact: true }).click();
  // The review is saved through the API, so wait until 6 becomes the saved reference.
  await expect(page.getByRole('button', { name: '검토 완료', exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: '메시지 상세 탭' }).getByRole('button', { name: '대화', exact: true }).click();
  await page.getByRole('button', { name: /^답변 (작성|이어서 작성하기)$/ }).click();
  await expect(page.locator('.board-reply-ai-note')).toHaveText('높은 위험 단계 · 승인된 공식 답변 양식과 공동 검토 절차를 확인해 주세요.');
  await expect(page.getByRole('button', { name: 'AI 답변 생성', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '공식 템플릿 적용', exact: true })).toBeDisabled();
  await page.getByRole('tab', { name: '직접 작성', exact: true }).click();
  const editor = page.locator('#board-reply-composer-input');
  await editor.fill('학교 생활을 확인한 뒤 다시 안내드리겠습니다.');
  await confirmSend(page);
  await expect(page.locator('.board-reply-teacher').last()).toContainText('학교 생활을 확인한 뒤 다시 안내드리겠습니다.');
});

test('High의 새 버전으로 바꿀 때 직접 입력한 값은 유지한다', async ({ page }) => {
  await page.goto('/teacher/messages/thread-004/response');
  await page.getByRole('button', { name: '공식 템플릿 적용', exact: true }).click();
  await page.getByRole('textbox', { name: '보호자 호칭', exact: true }).fill('수아');
  await page.getByLabel('상담 일시 선택', { exact: true }).fill('2026-10-26T16:00');
  await page.getByRole('textbox', { name: '직접 고칠 문장', exact: true }).fill('학교 생활을 확인하고 다시 안내드리겠습니다.');
  await page.evaluate(async () => {
    const moduleUrl = performance.getEntriesByType('resource').map((entry) => entry.name)
      .find((url) => /\/src\/features\/message\/replyTemplates\.ts(?:\?|$)/.test(url));
    if (!moduleUrl) throw new Error('현재 화면이 사용 중인 예시 데이터를 찾지 못했습니다.');
    const { replyTemplates } = await import(moduleUrl);
    replyTemplates.find((template: { templateId: string }) => template.templateId === 'tpl-student-observation').version = 2;
  });
  await page.getByRole('button', { name: '임시저장', exact: true }).click();
  await expect(page.getByRole('button', { name: '검토 후 전송', exact: true })).toBeDisabled();
  await expect(page.getByRole('textbox', { name: '직접 고칠 문장', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '템플릿 다시 적용', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '보호자 호칭', exact: true })).toHaveValue('수아');
  await expect(page.getByLabel('상담 일시 선택', { exact: true })).toHaveValue('2026-10-26T16:00');
  await expect(page.getByRole('textbox', { name: '직접 고칠 문장', exact: true })).toHaveValue('학교 생활을 확인하고 다시 안내드리겠습니다.');
  await page.getByRole('button', { name: '검토 후 전송', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '답변 전 확인', exact: true })).toContainText('템플릿 v2');
});

test('Low 메시지는 출처가 있는 AI 초안을 수정해 한 번만 전송한다', async ({ page }) => {
  await page.goto('/teacher/messages/thread-003/response');
  await page.locator('.board-reply-check-toggle').click();
  await expect(page.getByText(/현장체험학습 운영 계획 v0\.9 · 학교 A · 제5조/)).toBeVisible();
  await expect(page.getByText(/구버전 문서일 수 있어/)).toBeVisible();

  const editor = page.locator('#board-reply-composer-input');
  await expect(page.getByRole('tab', { name: 'AI 초안 활용', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(editor).toHaveValue(/현장체험학습 준비물/);
  await editor.fill('안녕하세요. 준비물은 안내장 기준으로 챙겨 주시면 됩니다. 감사합니다.');
  await confirmSend(page);

  await expect(page.locator('.board-reply-teacher')).toHaveCount(1);
  await expect(page.getByText('안녕하세요. 준비물은 안내장 기준으로 챙겨 주시면 됩니다. 감사합니다.')).toHaveCount(1);
});

test('답변 전송 시 날짜는 날짜 칩에 표시하고 메시지 옆에는 시간만 표시한다', async ({ page }, testInfo) => {
  await page.clock.setFixedTime(new Date('2026-10-25T14:12:00+09:00'));
  await page.goto('/teacher/messages/thread-002/response');
  await page.getByLabel('선생님 답변', { exact: true }).fill('학생 상황을 확인하고 다시 안내드리겠습니다.');
  await confirmSend(page);

  await expect(page.locator('.board-date-chip')).toHaveText([
    '2026년 8월 23일 일요일',
    '2026년 10월 25일 일요일',
  ]);
  const reply = page.locator('.board-reply-teacher').last();
  await expect(reply.locator('time')).toHaveText('오후 02:12');
  await expect(reply.locator('time')).toHaveAttribute('datetime', '2026-10-25T05:12:00.000Z');
  expect(await page.locator('.board-date-chip').last().evaluate((chip) => chip.nextElementSibling?.textContent))
    .toContain('학생 상황을 확인하고 다시 안내드리겠습니다.');
  await page.locator('.board-conversation').screenshot({ path: testInfo.outputPath('teacher-reply-date-chip.png') });
});

test('규정 자료에 없는 문의는 AI 초안을 만들지 않고 직접 작성만 허용한다', async ({ page }) => {
  await page.evaluate(() => {
    const at = '2026-08-10T10:00:00+09:00';
    localStorage.setItem('teacher-hub.parent-sent-messages.101', JSON.stringify([{
      messageId: 'lunch', teacherId: 'teacher-102', teacherName: '김OO 선생님', title: '급식 메뉴 문의',
      originalBody: '다음 주 급식 메뉴가 궁금합니다.', finalBody: '다음 주 급식 메뉴가 궁금합니다.',
      selectionType: 'ORIGINAL', selectionSource: 'ORIGINAL', status: 'SENT', sentAt: at,
      consultationStatus: 'before', auditLog: [{ action: 'SENT', at, selectionType: 'ORIGINAL' }],
    }]));
  });
  await page.goto('/teacher/messages/lunch/response');
  await expect(page.getByRole('button', { name: 'AI 답변 생성', exact: true })).toHaveCount(0);
  await expect(page.getByText(/관련 규정을 찾지 못해 AI 초안을 생성할 수 없습니다./).first()).toBeVisible();
  const manualTab = page.getByRole('tab', { name: '직접 작성', exact: true });
  await expect(manualTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#board-reply-composer-input')).toBeEnabled();
  await page.locator('#board-reply-composer-input').fill('작성 중인 답변');
  await page.getByRole('tab', { name: 'AI 초안 활용', exact: true }).click();
  await expect(page.locator('#board-reply-composer-input')).toBeDisabled();
  await manualTab.click();
  await expect(page.locator('#board-reply-composer-input')).toHaveValue('작성 중인 답변');
  await page.getByRole('button', { name: '메시지 상세로 돌아가기', exact: true }).click();
  await page.getByRole('button', { name: '답변 이어서 작성하기', exact: true }).click();
  await expect(manualTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#board-reply-composer-input')).toHaveValue('작성 중인 답변');

  await page.locator('#board-reply-composer-input').fill('다음 주 급식 메뉴는 학교 홈페이지에서 확인하실 수 있습니다.');
  await confirmSend(page);
  await expect(page.locator('.board-reply-teacher')).toHaveCount(1);
});

test('주의 문의도 규정이 없으면 기존 직접 작성 내용을 기본으로 연다', async ({ page }) => {
  await page.goto('/teacher/messages/thread-002');
  await page.evaluate(async () => {
    const url = performance.getEntriesByType('resource').map((entry) => entry.name)
      .find((path) => /\/mockThreads\.ts(?:\?|$)/.test(path));
    if (!url) throw new Error('Mock threads unavailable');
    const { initialTeacherThreads } = await import(url);
    const thread = initialTeacherThreads.find((item: { id: string }) => item.id === 'thread-002');
    thread.title = '급식 메뉴 문의';
    thread.latestMessage = thread.originalMessage = '급식 메뉴가 궁금합니다.';
    thread.replies = thread.replies.map((reply: { content: string }) => ({ ...reply, content: '급식 메뉴 문의입니다.' }));
  });
  await page.getByRole('button', { name: /^답변 (작성|이어서 작성하기)$/ }).click();
  await expect(page.getByRole('tab', { name: '직접 작성', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByLabel('선생님 답변', { exact: true })).toBeEnabled();
  await expect(page.getByLabel('선생님 답변', { exact: true })).toHaveValue('안녕하세요, 학부모님. 말씀해 주신 상황을 확인한 뒤 오늘 하교 전까지 안내드리겠습니다.');
});

test('High 메시지는 공식 템플릿 빈칸을 채워야 전송되고 주의 표현을 경고한다', async ({ page }) => {
  await page.goto('/teacher/messages/thread-004/response');
  await page.getByRole('button', { name: '공식 템플릿 적용', exact: true }).click();

  const editor = page.getByRole('textbox', { name: '직접 고칠 문장', exact: true });
  await expect(page.getByRole('group', { name: '답장 예시 편집', exact: true })).toContainText('학교에서는 학생 생활 관찰 기록 절차');
  await expect(page.locator('#board-reply-composer-input')).toHaveCount(0);
  const consultationTime = page.getByLabel('상담 일시 선택', { exact: true });
  await expect(consultationTime).toHaveAttribute('type', 'datetime-local');
  await expect(consultationTime).toHaveValue('');
  await expect(page.getByRole('button', { name: '검토 후 전송', exact: true })).toBeDisabled();

  await consultationTime.fill('2026-10-26T16:00');
  const filled = (await editor.inputValue()).replace('잘 확인했습니다.', '잘 확인했습니다. 반드시 살펴보겠습니다.');
  await editor.fill(filled);
  await page.getByRole('button', { name: '검토 후 전송', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '답변 전 확인', exact: true });
  await expect(dialog.getByText(/학생 생활 확인을 요청할 때 템플릿 v1/)).toBeVisible();
  await expect(dialog.getByText(/확인할 표현 1개: "반드시"/)).toBeVisible();
  await expect(dialog).toContainText('2026. 10. 26. 오후 04:00에 상담을 진행할 수 있도록');
  await dialog.getByRole('button', { name: '취소', exact: true }).click();
  await consultationTime.fill('');
  await expect(page.getByRole('button', { name: '검토 후 전송', exact: true })).toBeDisabled();
  await consultationTime.fill('2026-10-26T16:00');
  await confirmSend(page);
  await expect(page.locator('.board-reply-teacher')).toHaveCount(1);
  await expect(page.locator('.board-reply-teacher')).toContainText('2026. 10. 26. 오후 04:00');
});

test('Emergency 잠금은 위험도 검토 후에도 유지되고 답변 생성·전송을 막는다', async ({ page }) => {
  await page.goto('/teacher/messages/thread-001/response');
  await expect(page.getByRole('heading', { name: '이 메시지는 개별 답변을 보낼 수 없습니다', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: '선생님 답변', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'AI 답변 생성', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '검토 후 전송', exact: true })).toHaveCount(0);
  await expect(page.getByRole('tablist', { name: '답변 작성 방식', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '절차 안내 보기', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '절차 안내 보기', exact: true }).click();
  await expect(page).toHaveURL(/\/teacher\/guide\?post=guide-emergency-official-procedure$/);
  await page.getByRole('button', { name: '이전 화면으로 돌아가기', exact: true }).click();
  await expect(page).toHaveURL(/\/teacher\/messages\/thread-001\/response$/);
  await expect(page.getByRole('heading', { name: '이 메시지는 개별 답변을 보낼 수 없습니다', exact: true })).toBeVisible();

  await page.goto('/teacher/messages/thread-001');
  await page.getByRole('navigation', { name: '메시지 상세 탭' }).getByRole('button', { name: '위험 요소', exact: true }).click();
  await page.getByRole('button', { name: '검토 완료', exact: true }).click();
  await page.getByRole('navigation', { name: '메시지 상세 탭' }).getByRole('button', { name: '대화', exact: true }).click();
  await expect(page.getByText('긴급 단계에서는 답변 생성과 전송이 제한돼요.')).toBeVisible();
  await expect(page.getByRole('button', { name: /^답변 (작성|이어서 작성하기)$/ })).toHaveCount(0);
});

test('탭마다 작성 내용을 유지하고 선택한 직접 작성 답변만 검토 후 전송한다', async ({ page }) => {
  await page.goto('/teacher/messages/thread-003/response');
  const aiTab = page.getByRole('tab', { name: 'AI 초안 활용', exact: true });
  const manualTab = page.getByRole('tab', { name: '직접 작성', exact: true });
  const editor = page.getByRole('textbox', { name: '선생님 답변', exact: true });
  await expect(aiTab).toHaveAttribute('aria-selected', 'true');
  await expect(editor).toHaveValue(/현장체험학습 준비물/);
  const aiTabBox = (await aiTab.boundingBox())!;
  const manualTabBox = (await manualTab.boundingBox())!;
  expect(Math.abs(aiTabBox.y - manualTabBox.y)).toBeLessThan(1);
  expect(manualTabBox.x).toBeGreaterThan(aiTabBox.x);
  await expect(page.locator('.board-reply-notices')).toHaveCount(0);
  await editor.fill('AI 초안을 수정한 답변입니다.');
  await manualTab.click();
  await expect(editor).toHaveValue('');
  await expect(page.getByRole('button', { name: '검토 후 전송', exact: true })).toBeDisabled();
  await editor.fill('선생님이 직접 작성한 답변입니다.');
  await manualTab.press('ArrowLeft');
  await expect(aiTab).toBeFocused();
  await expect(editor).toHaveValue('AI 초안을 수정한 답변입니다.');
  await aiTab.press('ArrowRight');
  await expect(manualTab).toBeFocused();
  await expect(editor).toHaveValue('선생님이 직접 작성한 답변입니다.');
  await page.getByRole('button', { name: '검토 후 전송', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '답변 전 확인', exact: true });
  await expect(dialog).toContainText('선생님이 직접 작성한 답변입니다.');
  await expect(dialog).not.toContainText('AI 초안을 수정한 답변입니다.');
  await dialog.getByRole('button', { name: '취소', exact: true }).click();
  await confirmSend(page);
  await expect(page.locator('.board-reply-teacher')).toHaveCount(1);
  await expect(page.locator('.board-reply-teacher')).toContainText('선생님이 직접 작성한 답변입니다.');
  await page.getByRole('navigation', { name: '메시지 상세 탭' }).getByRole('button', { name: '처리 기록', exact: true }).click();
  await expect(page.getByText(/작성 방식: 직접 작성/)).toBeVisible();
});

test('임시저장·초기화는 현재 탭에만 적용하고 AI 초안은 한 번만 생성한다', async ({ page }) => {
  await page.goto('/teacher/messages/thread-003/response');
  const notice = page.locator('.ai-judgment-notice--inline');
  await expect(notice).toHaveCount(0);
  const aiTab = page.getByRole('tab', { name: 'AI 초안 활용', exact: true });
  const manualTab = page.getByRole('tab', { name: '직접 작성', exact: true });
  const editor = page.locator('#board-reply-composer-input');
  const status = page.locator('.board-reply-compose-header');
  const aiButtons = page.getByRole('button', { name: /^AI (다시 생성|답변 생성)$/ });
  await expect(editor).toHaveValue(/현장체험학습 준비물/);
  await expect(aiButtons).toHaveCount(0);
  await editor.fill('수정한 AI 답변');
  await page.getByRole('button', { name: '임시저장', exact: true }).click();
  await expect(status).toContainText('마지막 임시저장');
  await manualTab.click();
  await expect(status).not.toContainText('마지막 임시저장');
  await expect(notice).toHaveCount(0);
  await editor.fill('직접 작성한 답변');
  await aiTab.click();
  await expect(status).toContainText('마지막 임시저장');
  await page.getByRole('button', { name: '초기화', exact: true }).click();
  await expect(editor).toHaveValue('');
  await expect(notice).toHaveCount(0);
  await manualTab.click();
  await expect(editor).toHaveValue('직접 작성한 답변');
  await aiTab.click();
  await expect(editor).toHaveValue('');
  await expect(aiButtons).toHaveCount(0);
  await page.getByRole('button', { name: '메시지 상세로 돌아가기', exact: true }).click();
  await page.getByRole('button', { name: '답변 이어서 작성하기', exact: true }).click();
  await expect(editor).toHaveValue('');
  await expect(aiButtons).toHaveCount(0);
  await manualTab.click();
  await expect(editor).toHaveValue('직접 작성한 답변');
  await page.getByRole('button', { name: '초기화', exact: true }).click();
  await expect(editor).toHaveValue('');
  await aiTab.click();
  await expect(editor).toHaveValue('');
  await page.getByRole('button', { name: '메시지 상세로 돌아가기', exact: true }).click();
  await page.getByRole('navigation', { name: '메시지 상세 탭' }).getByRole('button', { name: '처리 기록', exact: true }).click();
  await expect(page.getByText('답변 초안 생성', { exact: true })).toHaveCount(1);
});

test('기존 직접 작성 초안을 보존하고 주의 단계에서도 AI 초안을 기본으로 표시한다', async ({ page }) => {
  await page.goto('/teacher/messages/thread-002/response');
  const editor = page.locator('#board-reply-composer-input');
  await expect(page.getByRole('tab', { name: 'AI 초안 활용', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(editor).toHaveValue(/박서준 학부모님/);
  await page.getByRole('tab', { name: '직접 작성', exact: true }).click();
  await expect(editor).toHaveValue('안녕하세요, 학부모님. 말씀해 주신 상황을 확인한 뒤 오늘 하교 전까지 안내드리겠습니다.');
});
