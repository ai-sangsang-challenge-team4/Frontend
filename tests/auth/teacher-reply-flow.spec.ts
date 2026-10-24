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
  await dialog.getByRole('checkbox').check();
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

test('High는 고정 문장을 유지하고 선택한 안내의 빈칸만 검사한다', async ({ page }) => {
  await page.goto('/teacher/messages/thread-004/response');
  await page.getByRole('button', { name: '공식 템플릿 적용', exact: true }).click();
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
  await page.getByRole('button', { name: '현장체험학습 운영 계획 원문 보기', exact: true }).click();
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
  await expect(page.getByRole('button', { name: '현장체험학습 운영 계획 원문 보기', exact: true })).toBeFocused();

  await page.goto('/teacher/messages/thread-002/response');
  await page.getByRole('button', { name: '학교 생활지도 규정 원문 보기', exact: true }).click();
  await expect(dialog).toContainText('제7조(학생 간 갈등 확인 절차)');
  await expect(dialog).not.toContainText('제5조(준비물 및 안전 수칙)');
});

test('High에서 맞는 예시가 없으면 AI 생성 없이 직접 작성한다', async ({ page }) => {
  await page.goto('/teacher/messages/thread-002');
  await page.getByRole('navigation', { name: '메시지 상세 탭' }).getByRole('button', { name: '위험 요소', exact: true }).click();
  await page.getByRole('button', { name: '6점 높은 위험', exact: true }).click();
  await page.getByRole('button', { name: '상향 반영', exact: true }).click();
  await page.getByRole('navigation', { name: '메시지 상세 탭' }).getByRole('button', { name: '대화', exact: true }).click();
  await page.getByRole('button', { name: /답변 (작성하러 가기|이어서 작성하기)/ }).click();
  await expect(page.locator('.board-reply-ai-note')).toContainText('맞는 공식 템플릿이 없습니다');
  await expect(page.getByRole('button', { name: 'AI 답변 생성', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '공식 템플릿 적용', exact: true })).toBeDisabled();
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
  await expect(page.getByText(/현장체험학습 운영 계획 v0\.9 · 학교 A · 제5조/)).toBeVisible();
  await expect(page.getByText(/구버전 문서일 수 있어/)).toBeVisible();

  await page.getByRole('button', { name: 'AI 답변 생성', exact: true }).click();
  const editor = page.locator('#board-reply-composer-input');
  await expect(editor).toHaveValue(/현장체험학습 준비물/);
  await editor.fill('안녕하세요. 준비물은 안내장 기준으로 챙겨 주시면 됩니다. 감사합니다.');
  await confirmSend(page);

  await expect(page.locator('.board-reply-teacher')).toHaveCount(1);
  await expect(page.getByText('안녕하세요. 준비물은 안내장 기준으로 챙겨 주시면 됩니다. 감사합니다.')).toHaveCount(1);
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
  await expect(page.getByRole('button', { name: 'AI 답변 생성', exact: true })).toBeDisabled();
  await expect(page.getByText(/관련 규정이 등록된 자료에 없어/).first()).toBeVisible();

  await page.locator('#board-reply-composer-input').fill('다음 주 급식 메뉴는 학교 홈페이지에서 확인하실 수 있습니다.');
  await confirmSend(page);
  await expect(page.locator('.board-reply-teacher')).toHaveCount(1);
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
  await expect(page.getByRole('button', { name: '절차 안내 보기', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '절차 안내 보기', exact: true }).click();
  await expect(page).toHaveURL(/\/teacher\/guide\?post=guide-emergency-official-procedure$/);

  await page.goto('/teacher/messages/thread-001');
  await page.getByRole('navigation', { name: '메시지 상세 탭' }).getByRole('button', { name: '위험 요소', exact: true }).click();
  await page.getByRole('button', { name: '검토 완료', exact: true }).click();
  await page.getByRole('navigation', { name: '메시지 상세 탭' }).getByRole('button', { name: '대화', exact: true }).click();
  await expect(page.getByText('지정 검토자가 잠금을 해제하기 전까지 답변 생성과 전송이 차단됩니다.')).toBeVisible();
  await expect(page.getByRole('button', { name: /답변 (작성하러 가기|이어서 작성하기)/ })).toHaveCount(0);
});
