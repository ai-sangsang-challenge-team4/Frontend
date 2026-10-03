import { expect, test, type Page } from '@playwright/test';
import type { AuthSession } from '../../src/features/auth/api/authApiContract';

const SESSION_KEY = 'teacher-hub.auth-session';
const ISSUED_KEY = 'teacher-hub.auth-mock-sessions';
const SETTINGS_KEY = 'teacher-hub.auth-mock-settings';
const ACCOUNTS_KEY = 'teacher-hub.auth-accounts';

const accounts = [
  { role: 'PARENT', email: 'parent@example.com', password: 'password123', home: '/parent' },
  { role: 'TEACHER', email: 'teacher@example.com', password: 'password123', home: '/teacher/messages' },
  { role: 'ADMIN', email: 'admin@teacherhub.local', password: 'admin1234', home: '/admin' },
] as const;

type MockSettings = {
  delayMs?: number;
  sessionDurationMs?: number;
  failures?: Record<string, 401 | 503>;
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript((key) => {
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, JSON.stringify({ delayMs: 50 }));
    }
  }, SETTINGS_KEY);
});

async function configureMock(page: Page, settings: MockSettings) {
  await page.evaluate(({ key, settings }) => {
    const current = JSON.parse(localStorage.getItem(key) ?? '{}');
    localStorage.setItem(key, JSON.stringify({ ...current, ...settings }));
  }, { key: SETTINGS_KEY, settings });
}

async function readSession(page: Page): Promise<AuthSession | null> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), SESSION_KEY);
}

async function fillLogin(page: Page, email: string, password: string) {
  await page.getByRole('heading', { name: '로그인', exact: true }).waitFor();
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
}

async function loginAs(page: Page, account: typeof accounts[number]) {
  await page.goto('/login');
  await fillLogin(page, account.email, account.password);
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${account.home}$`));
}

async function requestVerification(page: Page, email: string) {
  await page.locator('input[name="email"]').fill(email);
  await page.getByRole('button', { name: '인증번호 받기', exact: true }).click();
  await expect(page.locator('input[name="verificationCode"]')).toBeEnabled();
}

for (const account of accounts) {
  test(`${account.role}: 로그인, 역할 제한, 새로고침, 로그아웃`, async ({ page }) => {
    await loginAs(page, account);
    const session = await readSession(page);
    expect(session?.user.role).toBe(account.role);
    expect(session?.accessToken).toBeTruthy();
    expect(session?.refreshToken).toBeTruthy();
    expect(session?.expiresAt).toBeGreaterThan(Date.now());

    await page.reload();
    await expect(page.getByRole('button', { name: '로그아웃', exact: true }).first()).toBeAttached();
    await expect(page).toHaveURL(new RegExp(`${account.home}$`));

    for (const other of accounts.filter((entry) => entry.role !== account.role)) {
      await page.goto(other.home);
      await expect(page).toHaveURL(new RegExp(`${account.home}$`));
    }

    const logoutButton = page.getByRole('button', { name: '로그아웃', exact: true }).first();
    await logoutButton.click();
    await expect(page).toHaveURL(/\/login$/);
    expect(await readSession(page)).toBeNull();
    const tokenExists = await page.evaluate(({ key, token }) => {
      const sessions: { accessToken: string }[] = JSON.parse(localStorage.getItem(key) ?? '[]');
      return sessions.some((entry) => entry.accessToken === token);
    }, { key: ISSUED_KEY, token: session?.accessToken });
    expect(tokenExists).toBe(false);
    await page.goto(account.home);
    await expect(page).toHaveURL(/\/login$/);
  });
}

for (const role of ['PARENT', 'TEACHER'] as const) {
  test(`${role}: 이메일 인증 후 회원가입과 로그인`, async ({ page }) => {
    await page.goto(`/signup?role=${role}`);
    await expect(page.getByRole('radio', { name: role === 'PARENT' ? '학부모' : '교사' })).toBeChecked();
    await expect(page.getByRole('radio')).toHaveCount(2);
    await page.locator('input[name="name"]').fill('테스트 사용자');
    const email = `${role.toLowerCase()}-signup@example.com`;
    await requestVerification(page, email);
    await page.locator('input[name="verificationCode"]').fill('123456');
    await page.getByRole('button', { name: '인증하기', exact: true }).click();
    await expect(page.getByRole('button', { name: '인증 완료', exact: true })).toBeVisible();
    await page.locator('input[name="password"]').fill('newpassword123');
    await page.locator('input[name="passwordConfirmation"]').fill('newpassword123');
    await page.getByRole('button', { name: '회원가입', exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('status')).toHaveText('회원가입이 완료되었습니다. 로그인해 주세요.');
    await expect(page.locator('input[name="email"]')).toHaveValue(email);
    await page.locator('input[name="password"]').fill('newpassword123');
    await page.getByRole('button', { name: '로그인', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${role === 'PARENT' ? '/parent' : '/teacher/messages'}$`));
    expect((await readSession(page))?.user.role).toBe(role);
  });
}

test('비로그인 상태에서는 모든 역할 페이지의 접근을 제한한다', async ({ page }) => {
  for (const account of accounts) {
    await page.goto(account.home);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: '로그인', exact: true })).toBeVisible();
  }
});

test('로그인 후 원래 요청한 역할 내부 페이지로 돌아간다', async ({ page }) => {
  await page.goto('/parent/messages');
  await expect(page).toHaveURL(/\/login$/);
  await fillLogin(page, accounts[0].email, accounts[0].password);
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page).toHaveURL(/\/parent\/messages$/);
});

test('회원가입 필수값, 이메일 형식, 비밀번호 불일치를 표시한다', async ({ page }) => {
  await page.goto('/signup');
  await page.getByRole('button', { name: '회원가입', exact: true }).click();
  await expect(page.getByText('이름을 입력해 주세요.', { exact: true })).toBeVisible();
  await expect(page.getByText('비밀번호는 8자 이상 20자 이하로 입력해 주세요.', { exact: true })).toBeVisible();
  await page.locator('input[name="email"]').fill('invalid-email');
  await page.getByRole('button', { name: '인증번호 받기', exact: true }).click();
  await expect(page.getByText('이메일 형식으로 입력해 주세요.', { exact: true })).toBeVisible();
  await page.locator('input[name="email"]').fill('valid@example.com');
  await page.locator('input[name="password"]').fill('password123');
  await page.locator('input[name="passwordConfirmation"]').fill('different123');
  await page.getByRole('button', { name: '회원가입', exact: true }).click();
  await expect(page.getByText('비밀번호가 일치하지 않습니다.', { exact: true })).toBeVisible();
  expect(await readSession(page)).toBeNull();
});

test('이메일 대소문자와 관계없이 중복 계정을 거절한다', async ({ page }) => {
  await page.goto('/signup');
  await page.locator('input[name="email"]').fill('PARENT@EXAMPLE.COM');
  await page.getByRole('button', { name: '인증번호 받기', exact: true }).click();
  await expect(page.getByText('이미 가입되어 있는 이메일입니다.', { exact: true })).toBeVisible();
  await expect(page.locator('input[name="verificationCode"]')).toBeDisabled();
});

test('잘못된 로그인 정보는 오류를 표시하고 인증 정보를 저장하지 않는다', async ({ page }) => {
  await page.goto('/login');
  await fillLogin(page, accounts[0].email, 'wrong-password');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('이메일 또는 비밀번호가 올바르지 않습니다.');
  expect(await readSession(page)).toBeNull();
});

test('로그인 서비스 오류 후 다시 로그인할 수 있다', async ({ page }) => {
  await page.goto('/login');
  await configureMock(page, { failures: { login: 503 } });
  await fillLogin(page, accounts[0].email, accounts[0].password);
  const button = page.getByRole('button', { name: '로그인', exact: true });
  await button.click();
  await expect(page.getByRole('alert')).toContainText('인증 서비스를 이용할 수 없습니다.');
  await expect(button).toBeEnabled();
  expect(await readSession(page)).toBeNull();
  await configureMock(page, { failures: {} });
  await button.click();
  await expect(page).toHaveURL(/\/parent$/);
});

test('응답 지연 중에는 로딩을 표시하고 중복 로그인 요청을 막는다', async ({ page }) => {
  await page.goto('/login');
  await configureMock(page, { delayMs: 1000 });
  await fillLogin(page, accounts[0].email, accounts[0].password);
  const button = page.getByRole('button', { name: '로그인', exact: true });
  await button.click();
  await expect(button).toBeDisabled();
  await expect(button).toHaveAttribute('aria-busy', 'true');
  await page.locator('input[name="password"]').press('Enter');
  await expect(page).toHaveURL(/\/parent$/);
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]').length, ISSUED_KEY)).toBe(1);
});

test('저장된 사용자 역할 대신 토큰 조회 결과로 사용자 정보를 복원한다', async ({ page }) => {
  await loginAs(page, accounts[0]);
  await page.evaluate((key) => {
    const session = JSON.parse(localStorage.getItem(key)!);
    session.user = { ...session.user, role: 'ADMIN', name: '변경된 캐시' };
    session.expiresAt += 60_000;
    localStorage.setItem(key, JSON.stringify(session));
  }, SESSION_KEY);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/parent$/);
  const restored = await readSession(page);
  expect(restored?.user.role).toBe('PARENT');
  expect(restored?.user.name).toBe('학부모 사용자');
});

test('사용자 조회 중에는 보호된 페이지를 로그인 화면으로 보내지 않는다', async ({ page }) => {
  await loginAs(page, accounts[0]);
  await configureMock(page, { delayMs: 1000 });
  await page.reload();
  await expect(page.getByRole('status')).toHaveText('로그인 정보를 확인하고 있습니다.');
  await expect(page).toHaveURL(/\/parent$/);
  await expect(page.getByRole('heading', { name: '로그인', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '학부모 홈', exact: true })).toBeVisible();
});

test('사용 중 토큰이 만료되면 인증 정보를 제거하고 로그인으로 이동한다', async ({ page }) => {
  await page.clock.install();
  await page.goto('/login');
  await configureMock(page, { sessionDurationMs: 60_000 });
  await loginAs(page, accounts[0]);
  await page.clock.fastForward(61_000);
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('alert')).toHaveText('로그인 시간이 만료되었습니다. 다시 로그인해 주세요.');
  expect(await readSession(page)).toBeNull();
});

test('새로고침 시 만료된 토큰을 거절한다', async ({ page }) => {
  await loginAs(page, accounts[0]);
  await page.evaluate((key) => {
    const sessions = JSON.parse(localStorage.getItem(key)!);
    for (const session of sessions) session.expiresAt = Date.now() - 1;
    localStorage.setItem(key, JSON.stringify(sessions));
  }, ISSUED_KEY);
  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('alert')).toContainText('로그인 시간이 만료되었습니다.');
  expect(await readSession(page)).toBeNull();
});

test('등록되지 않은 토큰을 거절한다', async ({ page }) => {
  await loginAs(page, accounts[0]);
  await page.evaluate((key) => {
    const session = JSON.parse(localStorage.getItem(key)!);
    session.accessToken = 'unissued-token';
    localStorage.setItem(key, JSON.stringify(session));
  }, SESSION_KEY);
  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('alert')).toContainText('인증 정보가 유효하지 않습니다.');
  expect(await readSession(page)).toBeNull();
});

test('손상된 저장 데이터와 빈 토큰을 안전하게 제거한다', async ({ page }) => {
  for (const value of ['{invalid-json', '{"accessToken":"","refreshToken":"","expiresAt":0}', 'null']) {
    await page.goto('/login');
    await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: SESSION_KEY, value });
    await page.goto('/parent');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: '로그인', exact: true })).toBeVisible();
    expect(await readSession(page)).toBeNull();
  }
});

test('사용자 조회의 일시적 오류는 세션을 보존하고 재시도한다', async ({ page }) => {
  await loginAs(page, accounts[0]);
  await configureMock(page, { failures: { getCurrentUser: 503 } });
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('인증 서비스를 이용할 수 없습니다.');
  expect(await readSession(page)).not.toBeNull();
  await expect(page).toHaveURL(/\/parent$/);
  await configureMock(page, { failures: {} });
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page.getByRole('heading', { name: '학부모 홈', exact: true })).toBeVisible();
});

test('사용자 조회의 401 응답은 인증 상태를 초기화한다', async ({ page }) => {
  await loginAs(page, accounts[0]);
  await configureMock(page, { failures: { getCurrentUser: 401 } });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('alert')).toContainText('인증 정보가 유효하지 않습니다.');
  expect(await readSession(page)).toBeNull();
});

test('다른 탭의 로그아웃을 반영하고 늦은 사용자 조회가 세션을 되살리지 않는다', async ({ page, context }) => {
  await page.clock.install();
  await loginAs(page, accounts[0]);
  const otherTab = await context.newPage();
  await otherTab.goto('/parent');
  await expect(otherTab.getByRole('heading', { name: '학부모 홈', exact: true })).toBeVisible();
  await configureMock(page, { delayMs: 1000 });
  await otherTab.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(otherTab).toHaveURL(/\/login$/);
  await expect(otherTab.getByRole('heading', { name: '로그인', exact: true })).toBeVisible();
  await otherTab.clock.fastForward(1100);
  await expect(otherTab).toHaveURL(/\/login$/);
  expect(await readSession(otherTab)).toBeNull();
});

test('다른 탭에서 로그인하면 새 사용자 역할을 반영한다', async ({ page, context }) => {
  await loginAs(page, accounts[0]);
  const otherTab = await context.newPage();
  await otherTab.goto('/parent');
  await expect(otherTab.getByRole('button', { name: '로그아웃', exact: true })).toBeVisible();
  await otherTab.getByRole('button', { name: '로그아웃', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await fillLogin(otherTab, accounts[1].email, accounts[1].password);
  await otherTab.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(otherTab).toHaveURL(/\/teacher\/messages$/);
  await expect(page).toHaveURL(/\/teacher\/messages$/);
  expect((await readSession(page))?.user.role).toBe('TEACHER');
});

test('잘못된 인증번호, 인증 시간 만료, 재전송을 처리한다', async ({ page }) => {
  await page.clock.install();
  await page.goto('/signup');
  await requestVerification(page, 'verification@example.com');
  await page.locator('input[name="verificationCode"]').fill('000000');
  await page.getByRole('button', { name: '인증하기', exact: true }).click();
  await expect(page.getByText('인증코드가 올바르지 않습니다.', { exact: true })).toBeVisible();
  await page.clock.fastForward(181_000);
  await expect(page.locator('.auth-verification-timer')).toHaveText('0:00');
  await expect(page.getByRole('button', { name: '인증하기', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '재요청', exact: true }).click();
  await expect(page.locator('input[name="verificationCode"]')).toHaveValue('');
  await expect(page.getByRole('button', { name: '인증하기', exact: true })).toBeEnabled();
  await page.locator('input[name="verificationCode"]').fill('123456');
  await page.getByRole('button', { name: '인증하기', exact: true }).click();
  await expect(page.getByRole('button', { name: '인증 완료', exact: true })).toBeVisible();
});

test('이메일 변경 후 이전 인증번호 요청 응답을 적용하지 않는다', async ({ page }) => {
  await page.goto('/signup');
  await configureMock(page, { delayMs: 1000 });
  await page.locator('input[name="email"]').fill('first@example.com');
  await page.getByRole('button', { name: '인증번호 받기', exact: true }).click();
  await page.locator('input[name="email"]').fill('second@example.com');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('teacher-hub.auth-signup-code'))).not.toBeNull();
  await expect(page.locator('input[name="verificationCode"]')).toBeDisabled();
  await expect(page.locator('.auth-dev-code')).toHaveCount(0);
});

test('비밀번호 재설정 후 새 비밀번호로 로그인한다', async ({ page }) => {
  await page.goto('/forgot-password');
  await page.locator('input[name="email"]').fill(accounts[0].email);
  await page.getByRole('button', { name: '인증코드 전송하기', exact: true }).click();
  await page.locator('input[name="verificationCode"]').fill('123456');
  await page.locator('input[name="password"]').fill('changedpassword123');
  await page.locator('input[name="passwordConfirmation"]').fill('changedpassword123');
  await page.getByRole('button', { name: '확인', exact: true }).click();
  await expect(page.getByRole('heading', { name: /비밀번호 변경이/ })).toBeVisible();
  await page.getByRole('button', { name: '로그인하기', exact: true }).click();
  await fillLogin(page, accounts[0].email, accounts[0].password);
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('이메일 또는 비밀번호가 올바르지 않습니다.');
  await page.locator('input[name="password"]').fill('changedpassword123');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page).toHaveURL(/\/parent$/);
  const storedAccounts = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]'), ACCOUNTS_KEY);
  expect(storedAccounts.filter((entry: { email: string }) => entry.email === accounts[0].email)).toHaveLength(1);
});
