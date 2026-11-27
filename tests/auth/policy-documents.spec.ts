import { expect, test } from '@playwright/test';

const documents = [
  { title: '서비스 이용약관', sections: 8, acceptance: '[필수] 티처허브 서비스 이용약관에 동의합니다.' },
  { title: '개인정보 수집·이용 동의서', sections: 7, acceptance: '[필수] 개인정보 수집·이용에 동의합니다.' },
  { title: '테스트 메시지 저장·활용 동의서', sections: 5, acceptance: '[선택] 서비스 개선을 위한 테스트 메시지 저장 및 활용에 동의합니다.' },
];

for (const role of ['PARENT', 'TEACHER']) {
  test(`${role} 회원가입에서 약관 전문을 읽어도 동의나 입력 상태를 바꾸지 않는다`, async ({ page }) => {
    await page.goto(`/signup?role=${role}`);
    await page.locator('input[name="name"]').fill('김테스트');
    const required = page.getByRole('checkbox', { name: /서비스 이용약관/ });
    const optional = page.getByRole('checkbox', { name: /메시지 활용/ });
    for (const document of documents) {
      const trigger = page.getByRole('button', { name: `${document.title} 보기`, exact: true });
      await trigger.click();
      const dialog = page.getByRole('dialog', { name: document.title, exact: true });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('heading', { level: 3 })).toHaveCount(document.sections);
      await expect(dialog).toContainText('시행일 2026.11.22');
      await expect(dialog.getByRole('checkbox')).toHaveCount(0);
      await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
      const article = dialog.getByRole('article', { name: `${document.title} 전문`, exact: true });
      await article.focus();
      await page.keyboard.press('PageDown');
      await expect.poll(() => dialog.locator('.ui-modal-body').evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
      if (document.title === '개인정보 수집·이용 동의서') {
        await expect(dialog.getByRole('table')).toHaveCount(2);
        await expect(dialog.getByRole('cell', { name: '회원 탈퇴 시까지', exact: true })).toHaveCount(1);
        await expect(dialog.getByRole('cell', { name: /상담 종료일부터 최대 1년/ })).toHaveCount(3);
        const originalViewport = page.viewportSize()!;
        for (const width of [320, originalViewport.width]) {
          await page.setViewportSize({ width, height: originalViewport.height });
          await expect.poll(() => dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
          const footerClose = dialog.locator('.ui-modal-footer').getByRole('button', { name: '닫기', exact: true });
          await expect(footerClose).toBeInViewport();
        }
      }
      await dialog.getByText(document.acceptance, { exact: true }).scrollIntoViewIfNeeded();
      const close = dialog.locator('.ui-modal-footer').getByRole('button', { name: '닫기', exact: true });
      await close.focus();
      await page.keyboard.press('Tab');
      await expect(dialog.locator('.ui-modal-close')).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
      await expect(required).not.toBeChecked();
      await expect(optional).not.toBeChecked();
      await expect(page.locator('input[name="name"]')).toHaveValue('김테스트');
      await expect(page.getByRole('alert')).toHaveCount(0);
    }
  });
}

for (const account of [
  { role: 'PARENT', email: 'parent@example.com', password: 'password123', path: '/parent' },
  { role: 'TEACHER', email: 'teacher@example.com', password: 'password123', path: '/teacher' },
  { role: 'ADMIN', email: 'admin@teacherhub.local', password: 'admin1234', path: '/admin' },
]) {
  test(`${account.role} 마이페이지에서 약관 열람은 저장된 동의와 미저장 선택을 보존한다`, async ({ page }) => {
    await page.goto(`/login?role=${account.role}`);
    await page.locator('input[name="email"]').fill(account.email);
    await page.locator('input[name="password"]').fill(account.password);
    await page.getByRole('button', { name: '로그인', exact: true }).click();
    await expect(page).toHaveURL(/\/messages(?:\/new)?$/);
    await page.goto(`${account.path}/mypage`);
    await page.getByRole('tab', { name: '약관 및 동의', exact: true }).click();
    const required = page.getByRole('checkbox', { name: /서비스 이용약관/ });
    const optional = page.getByRole('checkbox', { name: /메시지 활용/ });
    await required.check();
    await optional.check();
    const storedConsent = await page.evaluate(() => Object.entries(localStorage).filter(([key]) => key.startsWith('teacher-hub.policy-consent.')));
    for (const document of documents) {
      const trigger = page.getByRole('button', { name: `${document.title} 보기`, exact: true });
      await trigger.click();
      const dialog = page.getByRole('dialog', { name: document.title, exact: true });
      await expect(dialog).toBeVisible();
      await dialog.locator('.ui-modal-footer').getByRole('button', { name: '닫기', exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
      await expect(required).toBeChecked();
      await expect(optional).toBeChecked();
    }
    expect(await page.evaluate(() => Object.entries(localStorage).filter(([key]) => key.startsWith('teacher-hub.policy-consent.')))).toEqual(storedConsent);
    await expect(page.getByRole('region', { name: '동의 현황', exact: true }).getByRole('status')).toContainText('변경한 동의 내용이 아직 저장되지 않았어요.');
  });
}

test('메인 하단에서 로그인 없이 약관 3종을 열람한다', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('teacher-hub.landing-intro-seen', 'true'));
  await page.goto('/');
  const footer = page.locator('.landing-footer');
  for (const document of documents) {
    const trigger = footer.getByRole('button', { name: `${document.title} 보기`, exact: true });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: document.title, exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(document.acceptance, { exact: true })).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  }
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate(() => sessionStorage.getItem('teacher-hub.auth-session'))).toBeNull();
});
