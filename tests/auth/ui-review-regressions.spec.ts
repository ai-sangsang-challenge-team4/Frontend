import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/fixtures/common-ui.html');
  await expect(page.getByRole('heading', { name: '공통 UI 검증' })).toBeVisible();
});

test('Popover의 제어된 닫힘은 내부 focus를 복귀시키고 Tab으로 나간 focus는 유지한다', async ({ page }) => {
  const trigger = page.getByRole('button', { name: '제어 설명', exact: true });
  const outside = page.getByRole('button', { name: '설명 밖 작업', exact: true });
  await trigger.click();
  await page.getByLabel('제어 설명 입력', { exact: true }).focus();
  // Parent state changes while focus remains in the content.
  await outside.evaluate((element) => (element as HTMLButtonElement).click());
  await expect(page.getByRole('dialog', { name: '제어 설명' })).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.getByLabel('제어 설명 입력', { exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(outside).toBeFocused();
  await expect(page.getByRole('dialog', { name: '제어 설명' })).toHaveCount(0);
});

test('Popover 포털 자손의 자동 focus와 pointerdown은 내부 동작으로 처리된다', async ({ page }) => {
  const trigger = page.getByRole('button', { name: '포털 설명', exact: true });
  await trigger.click();
  await page.getByRole('button', { name: '포털 창 열기' }).click();
  const dialog = page.getByRole('dialog', { name: '포털 확인', exact: true });
  await expect(dialog).toBeVisible();
  await page.getByLabel('포털 입력', { exact: true }).fill('포털 내부 작성');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '포털 창 닫기' }).click();
  await expect(page.getByRole('dialog', { name: '포털 설명', exact: true })).toBeVisible();
  await page.getByRole('heading', { name: '공통 UI 검증' }).click();
  await expect(page.getByRole('dialog', { name: '포털 설명', exact: true })).toHaveCount(0);
});

test('처리되지 않은 포털 Escape는 Popover를 닫고 중첩 모달의 Escape는 모달만 닫는다', async ({ page }) => {
  const trigger = page.getByRole('button', { name: '일반 포털 설명', exact: true });
  await trigger.click();
  await page.getByRole('button', { name: '포털 내부 작업', exact: true }).focus();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '일반 포털 설명', exact: true })).toHaveCount(0);
  await expect(trigger).toBeFocused();

  await page.getByRole('button', { name: '포털 설명', exact: true }).click();
  await page.getByRole('button', { name: '포털 창 열기', exact: true }).click();
  await page.getByLabel('포털 입력', { exact: true }).focus();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '포털 확인', exact: true })).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: '포털 설명', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '포털 창 열기', exact: true }).focus();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '포털 설명', exact: true })).toHaveCount(0);
});

test('Tooltip을 비활성화하고 다시 활성화해도 이전 설명이 다시 열리지 않는다', async ({ page }) => {
  await page.getByRole('button', { name: '전환 설명 대상', exact: true }).hover();
  await expect(page.getByRole('tooltip')).toHaveText('전환 가능한 설명');
  const toggle = page.getByRole('button', { name: '설명 비활성 전환', exact: true });
  await toggle.evaluate((element) => (element as HTMLButtonElement).click());
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await page.getByRole('heading', { name: '공통 UI 검증' }).hover();
  await toggle.evaluate((element) => (element as HTMLButtonElement).click());
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await page.getByRole('button', { name: '전환 설명 대상', exact: true }).hover();
  await expect(page.getByRole('tooltip')).toHaveText('전환 가능한 설명');
});

for (const kind of ['일반', '업무']) {
  test(`${kind} 모달이 소유한 포털은 사용 가능하고 배경과 아래 창의 포털은 차단한다`, async ({ page }) => {
    await page.evaluate(() => {
      const background = document.createElement('button');
      background.id = 'unowned-portal';
      background.textContent = '배경 포털 작업';
      document.body.append(background);
    });
    const trigger = page.getByRole('button', { name: `소유 포털 ${kind} 창 열기`, exact: true });
    await trigger.click();
    const portal = page.getByRole('group', { name: '모달 소유 포털', exact: true });
    await expect(portal).toBeVisible();
    await expect(portal).toHaveJSProperty('inert', false);
    // The linked description shares #root with background controls. Only its branch is exposed.
    await expect(page.locator('#portal-background-description')).toHaveJSProperty('inert', false);
    await expect(trigger).toHaveJSProperty('inert', true);
    await expect(page.locator('#unowned-portal')).toHaveJSProperty('inert', true);
    const accessibilitySession = await page.context().newCDPSession(page);
    const { nodes } = await accessibilitySession.send('Accessibility.getFullAXTree');
    expect(nodes.some((node) => !node.ignored && node.name?.value === '포털 선택 0')).toBe(true);
    expect(nodes.some((node) => !node.ignored && node.name?.value === `소유 포털 ${kind} 창 열기`)).toBe(false);
    await accessibilitySession.detach();
    await portal.getByRole('button', { name: '포털 선택 0', exact: true }).click();
    await expect(portal.getByRole('button', { name: '포털 선택 1', exact: true })).toBeVisible();
    await page.evaluate(() => {
      const background = document.createElement('button');
      background.id = 'late-background-portal';
      document.body.append(background);
    });
    await expect(page.locator('#late-background-portal')).toHaveJSProperty('inert', true);
    await portal.getByRole('button', { name: '소유 포털 도움말', exact: true }).focus();
    const tooltip = page.getByRole('tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toHaveJSProperty('inert', false);
    await tooltip.hover();
    await page.keyboard.press('Escape');
    await expect(tooltip).toHaveCount(0);
    const upperTrigger = portal.getByRole('button', { name: '포털에서 위 창 열기', exact: true });
    await upperTrigger.click();
    const upper = page.getByRole('dialog', { name: '포털 위 확인창', exact: true });
    await expect(upper).toBeVisible();
    await expect(page.locator('[aria-label="모달 소유 포털"]')).toHaveJSProperty('inert', true);
    await page.keyboard.press('Escape');
    await expect(upper).toHaveCount(0);
    await expect(portal).toHaveJSProperty('inert', false);
    await expect(upperTrigger).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('dialog', { name: '포털 소유 확인', exact: true }).getByRole('button', { name: '닫기', exact: true })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(upperTrigger).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(portal).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(page.locator('#root')).toHaveJSProperty('inert', false);
    await expect(page.locator('#unowned-portal')).toHaveJSProperty('inert', false);
    await expect(page.locator('#late-background-portal')).toHaveJSProperty('inert', false);
  });
}

test.describe('터치에서 키보드로 입력 전환', () => {
  test.use({ hasTouch: true });
  for (const key of ['Enter', 'Space']) {
    test(`Tooltip을 두 번 터치해 닫은 뒤 ${key}로 다시 연다`, async ({ page }) => {
      const trigger = page.getByRole('button', { name: '용어 설명', exact: true });
      await trigger.tap();
      await expect(page.getByRole('tooltip')).toBeVisible();
      await trigger.tap();
      await expect(page.getByRole('tooltip')).toHaveCount(0);
      await expect(trigger).toBeFocused();
      await page.keyboard.press(key);
      await expect(page.getByRole('tooltip')).toBeVisible();
    });
  }
});

test('Tooltip 정리 뒤에도 갱신된 오류의 설명 id를 보존한다', async ({ page }) => {
  const input = page.getByLabel('설명 입력 필드', { exact: true });
  await input.focus();
  await expect(page.getByRole('tooltip')).toHaveText('입력 형식 설명');
  await page.getByRole('button', { name: '입력 오류 전환' }).evaluate((element) => (element as HTMLButtonElement).click());
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await expect(input).toHaveAttribute('aria-describedby', /tooltip-validating-field-error/);
  await expect(input).not.toHaveAttribute('aria-describedby', /tooltip-validating-field-helper/);
  await page.keyboard.press('Escape');
  await expect(input).toHaveAttribute('aria-describedby', 'tooltip-validating-field-error');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
});

test('Tooltip 위 포인터는 Tab으로 focus가 나가도 설명을 유지한다', async ({ page }) => {
  await page.getByRole('button', { name: '용어 설명', exact: true }).focus();
  const tooltip = page.getByRole('tooltip').filter({ hasText: 'AI 완충 요약은' });
  await tooltip.hover();
  await page.keyboard.press('Tab');
  await expect(tooltip).toBeVisible();
  await page.getByRole('heading', { name: '공통 UI 검증' }).hover();
  await expect(tooltip).toHaveCount(0);
});

test('중첩 확인창은 위 창만 Escape를 처리하고 아래 창의 focus·잠금은 유지한다', async ({ page }) => {
  await page.getByRole('button', { name: '아래 창 열기', exact: true }).click();
  await page.getByRole('button', { name: '위 창 열기', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '위 창', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '위 창', exact: true })).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: '아래 창', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '위 창 열기', exact: true })).toBeFocused();
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: '아래 창 열기', exact: true })).toBeFocused();
});

test('아래 모달을 먼저 닫아도 마지막 창 종료 후 원래 inert·scroll 상태를 복원한다', async ({ page }) => {
  await page.evaluate(() => {
    document.body.style.overflow = 'scroll';
    const existing = document.createElement('aside');
    existing.id = 'already-inert';
    existing.inert = true;
    document.body.append(existing);
  });
  const trigger = page.getByRole('button', { name: '아래 창 열기', exact: true });
  await trigger.click();
  await page.getByRole('button', { name: '위 창 열기', exact: true }).click();
  await page.getByRole('button', { name: '아래 창만 닫기', exact: true }).click();
  expect(await page.locator('#root').evaluate((element) => (element as HTMLElement).inert)).toBe(true);
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
  await page.getByRole('button', { name: '위 창만 닫기', exact: true }).click();
  expect(await page.locator('#root').evaluate((element) => (element as HTMLElement).inert)).toBe(false);
  expect(await page.locator('#already-inert').evaluate((element) => (element as HTMLElement).inert)).toBe(true);
  await expect(page.locator('body')).toHaveCSS('overflow', 'scroll');
  await expect(trigger).toBeFocused();
});

test('모달의 마지막 Dropdown 옵션에서도 Tab 순환과 역방향 이동을 유지한다', async ({ page }) => {
  await page.getByRole('button', { name: '선택 창 열기', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '선택 확인', exact: true });
  const select = dialog.getByRole('button', { name: '대화상자 값 선택', exact: true });
  await select.click();
  await page.keyboard.press('End');
  await expect(dialog.getByRole('option', { name: '선택 마지막 항목' })).toBeFocused();
  await page.evaluate(() => {
    window.addEventListener('keydown', (event) => {
      document.body.dataset.modalTabHandled = String(event.defaultPrevented);
    }, { once: true });
  });
  await page.keyboard.press('Tab');
  await expect(page.locator('body')).toHaveAttribute('data-modal-tab-handled', 'true');
  await expect(dialog.getByRole('button', { name: '닫기', exact: true })).toBeFocused();
  await expect(dialog.getByRole('listbox')).toHaveCount(0);
  await page.keyboard.press('Shift+Tab');
  await expect(select).toBeFocused();
  await select.click();
  await page.keyboard.press('Shift+Tab');
  await expect(select).toBeFocused();
});

for (const selected of [false, true]) {
  test(`모달의 ${selected ? '선택된' : '미선택'} 라디오 그룹에서 Tab을 순환한다`, async ({ page }) => {
    await page.getByRole('button', { name: selected ? '선택된 라디오 창 열기' : '라디오 창 열기', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '라디오 확인', exact: true });
    const close = dialog.getByRole('button', { name: '닫기', exact: true });
    const first = dialog.getByRole('radio', { name: '라디오 첫 항목', exact: true });
    const last = dialog.getByRole('radio', { name: '라디오 마지막 항목', exact: true });
    await close.focus();
    await page.keyboard.press('Tab');
    await expect(first).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(close).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(selected ? first : last).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(close).toBeFocused();
    await last.check();
    await page.keyboard.press('Tab');
    await expect(close).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(last).toBeFocused();
  });
}
