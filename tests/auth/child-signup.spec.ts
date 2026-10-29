import { expect, test } from '@playwright/test';
import { validateChildSignupInfo, type ChildSignupInfo } from '../../src/features/auth/childSignup';
import { fillChildInformation } from './helpers/childSignup';

test('학부모에게만 자녀 정보를 표시하고 계정 유형을 바꿔도 입력한 정보를 유지한다', async ({ page }) => {
  await page.goto('/signup?role=PARENT');
  await expect(page.getByRole('group', { name: '기본 정보' })).toBeVisible();
  await expect(page.getByRole('group').first()).toHaveAccessibleName('계정 유형 *');
  await expect(page.getByRole('group').nth(1)).toHaveAccessibleName('기본 정보 *');
  await expect(page.getByLabel('이름 *', { exact: true })).toHaveCount(0);
  await page.getByLabel('아이디').fill('role-change@example.com');
  await page.getByLabel('비밀번호 *', { exact: true }).fill('password123');
  await fillChildInformation(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const heading = page.getByRole('group', { name: '기본 정보' }).locator('legend');
  await heading.evaluate((element) => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await heading.screenshot({
    path: test.info().outputPath('child-information.png'),
  });
  await page.getByText('교사', { exact: true }).click();
  await expect(page.getByRole('group', { name: '기본 정보' })).toHaveCount(0);
  await page.getByLabel('이름 *', { exact: true }).fill('교사 이름');
  await page.getByRole('combobox', { name: '소속학교', exact: true }).fill('상상고');
  await page.getByRole('option', { name: '상상고등학교 예시 학교' }).click();
  await page.getByLabel('교번', { exact: true }).fill('T-001');
  await expect(page.getByLabel('아이디')).toHaveValue('role-change@example.com');
  await expect(page.getByLabel('비밀번호 *', { exact: true })).toHaveValue('password123');
  await page.getByText('학부모', { exact: true }).click();
  await expect(page.getByLabel('이름 *', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('교번', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: '학교', exact: true })).toHaveValue('상상초등학교');
  await expect(page.getByLabel('학년', { exact: true })).toHaveValue('6');
  await expect(page.getByLabel('번호', { exact: true })).toHaveValue('17');
  await expect(page.getByLabel('자녀 이름')).toHaveValue('  김상상  ');
  await page.getByText('교사', { exact: true }).click();
  await expect(page.getByLabel('이름 *', { exact: true })).toHaveValue('교사 이름');
  await expect(page.getByRole('combobox', { name: '소속학교', exact: true })).toHaveValue('상상고등학교');
  await expect(page.getByLabel('교번', { exact: true })).toHaveValue('T-001');
});

test('학교 → 학년 → 반 → 번호 순서로 활성화하며 상위 항목 변경 시 하위 항목을 초기화한다', async ({ page }) => {
  await page.goto('/signup');
  const school = page.getByRole('combobox', { name: '학교', exact: true });
  const grade = page.getByLabel('학년', { exact: true });
  const schoolClass = page.getByLabel('반', { exact: true });
  const studentNumber = page.getByLabel('번호', { exact: true });
  await expect(grade).toBeDisabled();
  await expect(schoolClass).toBeDisabled();
  await expect(studentNumber).toBeDisabled();

  await school.fill('상상초등');
  await page.getByRole('option', { name: '상상초등학교 예시 학교' }).click();
  await expect(grade).toBeEnabled();
  await expect(grade.locator('option')).toHaveCount(7);
  await expect(schoolClass).toBeDisabled();
  await grade.selectOption('6');
  await expect(schoolClass).toBeEnabled();
  await expect(studentNumber).toBeDisabled();
  await schoolClass.selectOption('2');
  await expect(studentNumber).toBeEnabled();
  await studentNumber.selectOption('17');

  await schoolClass.selectOption('3');
  await expect(studentNumber).toHaveValue('');
  await studentNumber.selectOption('12');
  await grade.selectOption('5');
  await expect(schoolClass).toHaveValue('');
  await expect(studentNumber).toHaveValue('');
  await expect(studentNumber).toBeDisabled();
  await schoolClass.selectOption('1');
  await studentNumber.selectOption('30');

  await school.fill('상상중');
  await expect(grade).toHaveValue('');
  await expect(grade).toBeDisabled();
  await expect(schoolClass).toHaveValue('');
  await expect(schoolClass).toBeDisabled();
  await expect(studentNumber).toHaveValue('');
  await expect(studentNumber).toBeDisabled();
  await page.getByRole('option', { name: '상상중학교 예시 학교' }).click();
  await expect(grade.locator('option')).toHaveCount(4);
  await grade.selectOption('3');
  await school.fill('상상고');
  await page.getByRole('option', { name: '상상고등학교 예시 학교' }).click();
  await expect(grade.locator('option')).toHaveCount(4);
  await expect(grade).toHaveValue('');
});

test('학교 검색의 빈 결과와 키보드 선택을 지원하고 선택 전에는 학년을 활성화하지 않는다', async ({ page }) => {
  await page.goto('/signup');
  const school = page.getByRole('combobox', { name: '학교', exact: true });
  await school.fill('없는학교');
  await expect(page.getByRole('status')).toHaveText('검색 결과가 없습니다. 다른 학교 이름으로 검색해 주세요.');
  await expect(page.getByLabel('학년', { exact: true })).toBeDisabled();
  await school.press('ArrowDown');
  await school.press('Enter');
  await expect(page).toHaveURL(/\/signup$/);
  await school.fill('상상');
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(3);
  await school.press('ArrowUp');
  await school.press('Enter');
  await expect(school).toHaveValue('상상고등학교');
  await expect(school).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByLabel('학년', { exact: true })).toBeEnabled();
  await school.fill('상상초등학교');
  await expect(page.getByLabel('학년', { exact: true })).toBeDisabled();
  await school.press('ArrowDown');
  await school.press('Enter');
  await expect(page.getByLabel('학년', { exact: true })).toBeEnabled();
  await school.click();
  await expect(school).toHaveAttribute('aria-expanded', 'true');
  await school.press('Escape');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await page.getByLabel('자녀 이름').focus();
  await school.focus();
  await school.press('Tab');
  await expect(page.getByRole('listbox')).toHaveCount(0);
});

test('자녀 정보 누락과 공백 이름을 차단하고 회원가입 실패 후에도 입력값과 이메일 인증을 유지한다', async ({ page }) => {
  await page.goto('/signup');
  await page.getByLabel('아이디').fill('child-validation@example.com');
  await page.getByRole('button', { name: '인증번호 받기', exact: true }).click();
  await page.getByLabel('인증 *', { exact: true }).fill('123456');
  await page.getByRole('button', { name: '인증하기', exact: true }).click();
  await expect(page.getByRole('button', { name: '인증 완료' })).toBeVisible();
  await page.getByLabel('비밀번호 *', { exact: true }).fill('password123');
  await page.getByLabel('비밀번호 확인').fill('password123');
  await page.getByRole('button', { name: '회원가입', exact: true }).click();
  for (const name of ['학교', '학년', '반', '번호']) {
    await expect(page.getByRole('combobox', { name, exact: true })).toHaveAttribute('aria-invalid', 'true');
  }
  await expect(page.getByLabel('자녀 이름')).toHaveAttribute('aria-invalid', 'true');
  expect(await page.evaluate(() => localStorage.getItem('teacher-hub.auth-accounts'))).toBeNull();
  await fillChildInformation(page);
  await page.getByLabel('자녀 이름').fill('   ');
  await page.getByRole('button', { name: '회원가입', exact: true }).click();
  await expect(page.getByText('자녀 이름을 입력해 주세요.', { exact: true })).toBeVisible();
  await page.getByLabel('자녀 이름').fill('김상상');
  await page.evaluate(() => localStorage.setItem('teacher-hub.auth-mock-settings', JSON.stringify({
    failures: { signup: 503 },
  })));
  await page.getByRole('button', { name: '회원가입', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('인증 서비스를 이용할 수 없습니다.');
  await expect(page.getByLabel('학년', { exact: true })).toHaveValue('6');
  await expect(page.getByLabel('번호', { exact: true })).toHaveValue('17');
  await expect(page.getByRole('button', { name: '인증 완료' })).toBeVisible();
  await page.evaluate(() => localStorage.removeItem('teacher-hub.auth-mock-settings'));
  await page.getByRole('button', { name: '회원가입', exact: true }).click();
  await expect(page).toHaveURL(/\/login\?role=PARENT$/);
});

test('교사로 전환해 가입하면 입력했던 자녀 정보를 저장하지 않는다', async ({ page }) => {
  await page.goto('/signup');
  await fillChildInformation(page);
  await page.getByRole('button', { name: '회원가입', exact: true }).click();
  await page.getByText('교사', { exact: true }).click();
  await page.getByLabel('이름 *', { exact: true }).fill('교사');
  await page.getByRole('combobox', { name: '소속학교', exact: true }).fill('상상중');
  await page.getByRole('option', { name: '상상중학교 예시 학교' }).click();
  await page.getByLabel('교번', { exact: true }).fill('00123');
  await page.getByLabel('아이디').fill('teacher-switch@example.com');
  await page.getByRole('button', { name: '인증번호 받기', exact: true }).click();
  await page.getByLabel('인증 *', { exact: true }).fill('123456');
  await page.getByRole('button', { name: '인증하기', exact: true }).click();
  await expect(page.getByRole('button', { name: '인증 완료' })).toBeVisible();
  await page.getByLabel('비밀번호 *', { exact: true }).fill('password123');
  await page.getByLabel('비밀번호 확인').fill('password123');
  await page.getByRole('button', { name: '회원가입', exact: true }).click();
  await expect(page).toHaveURL(/\/login\?role=TEACHER$/);
  const accounts = await page.evaluate(() => JSON.parse(localStorage.getItem('teacher-hub.auth-accounts') ?? '[]'));
  expect(accounts.find((account: { email: string }) => account.email === 'teacher-switch@example.com'))
    .toMatchObject({ role: 'TEACHER' });
  expect(accounts.find((account: { email: string }) => account.email === 'teacher-switch@example.com'))
    .not.toHaveProperty('child');
});

test('입력값을 조작해 학교급·학급 범위를 벗어나면 자녀 정보 검증에 실패한다', () => {
  const valid: ChildSignupInfo = {
    schoolId: 'mock-middle', grade: 3, classNumber: 2, studentNumber: 17, name: '김상상',
  };
  expect(validateChildSignupInfo(valid)).toEqual({});
  expect(Object.keys(validateChildSignupInfo(undefined))).toHaveLength(5);
  for (const change of [
    { schoolId: 'unknown-school' }, { grade: 4 }, { classNumber: 99 }, { studentNumber: 0 },
    { studentNumber: 31 }, { studentNumber: 1.5 }, { name: '   ' },
  ]) {
    expect(Object.keys(validateChildSignupInfo({ ...valid, ...change })).length).toBeGreaterThan(0);
  }
});
