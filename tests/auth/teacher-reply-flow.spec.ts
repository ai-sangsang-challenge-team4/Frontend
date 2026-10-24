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

  const editor = page.locator('#board-reply-composer-input');
  await expect(editor).toHaveValue(/학생 생활 관찰 기록 절차/);
  await expect(editor).toHaveValue(/\[상담 일시 선택\]/);
  await expect(page.getByText('빈칸을 채워 주세요: 상담 일시 선택')).toBeVisible();
  await expect(page.getByRole('button', { name: '검토 후 전송', exact: true })).toBeDisabled();

  const filled = (await editor.inputValue()).replace('[상담 일시 선택]', '8월 25일 오후 4시').replace('잘 확인했습니다.', '잘 확인했습니다. 반드시 살펴보겠습니다.');
  await editor.fill(filled);
  await page.getByRole('button', { name: '검토 후 전송', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '답변 전 확인', exact: true });
  await expect(dialog.getByText(/학생 생활 확인을 요청할 때 템플릿 v1/)).toBeVisible();
  await expect(dialog.getByText(/확인할 표현 1개: "반드시"/)).toBeVisible();
  await dialog.getByRole('button', { name: '취소', exact: true }).click();
  await confirmSend(page);
  await expect(page.locator('.board-reply-teacher')).toHaveCount(1);
});

test('Emergency 잠금은 위험도 검토 후에도 유지되고 답변 생성·전송을 막는다', async ({ page }) => {
  await page.goto('/teacher/messages/thread-001/response');
  await expect(page.locator('#board-reply-composer-input')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'AI 답변 생성', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '검토 후 전송', exact: true })).toBeDisabled();

  await page.goto('/teacher/messages/thread-001');
  await page.getByRole('navigation', { name: '메시지 상세 탭' }).getByRole('button', { name: '위험 요소', exact: true }).click();
  await page.getByRole('button', { name: '검토 완료', exact: true }).click();
  await page.getByRole('navigation', { name: '메시지 상세 탭' }).getByRole('button', { name: '대화', exact: true }).click();
  await expect(page.getByText('지정 검토자가 잠금을 해제하기 전까지 답변 생성과 전송이 차단됩니다.')).toBeVisible();
  await expect(page.getByRole('button', { name: /답변 (작성하러 가기|이어서 작성하기)/ })).toHaveCount(0);
});
