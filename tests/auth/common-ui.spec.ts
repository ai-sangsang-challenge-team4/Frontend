import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/fixtures/common-ui.html');
  await expect(page.getByRole('heading', { name: '공통 UI 검증' })).toBeVisible();
});

test('Dropdown은 방향키로 비활성 항목을 건너뛰고 선택·Escape·Tab으로 닫힌다', async ({ page }) => {
  const trigger = page.getByRole('button', { name: '값 선택', exact: true });
  await trigger.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('option', { name: '첫 항목' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  const last = page.getByRole('option', { name: '마지막 항목 보조 설명' });
  await expect(last).toBeFocused();
  await page.keyboard.press('Home');
  await expect(page.getByRole('option', { name: '첫 항목' })).toBeFocused();
  await page.keyboard.press('End');
  await expect(last).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(trigger).toBeFocused();
  await expect(trigger).toContainText('마지막 항목');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: '다음 작업' })).toBeFocused();
  await expect(page.getByRole('listbox')).toHaveCount(0);
});

for (const [triggerName, dialogName] of [['일반 확인창', '공통 확인'], ['업무 확인창', '업무 확인']]) {
  test(`${dialogName}은 초기 focus·Tab 순환·배경 차단·Escape 복귀를 제공한다`, async ({ page }) => {
    const trigger = page.getByRole('button', { name: triggerName, exact: true });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: dialogName, exact: true });
    await expect(dialog).toBeFocused();
    expect(await page.locator('#root').evaluate((root) => (root as HTMLElement).inert)).toBe(true);
    await page.keyboard.press('Tab');
    const close = dialog.getByRole('button', { name: '닫기', exact: true });
    await expect(close).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    const last = dialog.getByRole('button', { name: dialogName === '공통 확인' ? '확인' : '취소', exact: true });
    await expect(last).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(close).toBeFocused();
    if (dialogName === '업무 확인') {
      const rerender = dialog.getByRole('button', { name: '재렌더링 0' });
      await rerender.click();
      await expect(dialog.getByRole('button', { name: '재렌더링 1' })).toBeFocused();
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(await page.locator('#root').evaluate((root) => (root as HTMLElement).inert)).toBe(false);
    await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  });
}

test('Tooltip은 중복 Tab 정지 없이 열리고 포인터 유지·Escape·터치 닫기를 지원한다', async ({ page }, testInfo) => {
  const trigger = page.getByRole('button', { name: '용어 설명', exact: true });
  await trigger.focus();
  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-describedby', await tooltip.getAttribute('id') as string);
  await expect(trigger.locator('..')).not.toHaveAttribute('tabindex', '0');
  const rect = await tooltip.boundingBox();
  expect(rect!.x).toBeGreaterThanOrEqual(16);
  expect(rect!.x + rect!.width).toBeLessThanOrEqual(page.viewportSize()!.width - 15);
  await page.keyboard.press('Escape');
  await expect(tooltip).toHaveCount(0);
  if (testInfo.project.name === 'mobile') {
    await trigger.tap();
    await expect(tooltip).toBeVisible();
    await trigger.tap();
    await expect(tooltip).toHaveCount(0);
  } else {
    await page.getByRole('heading', { name: '공통 UI 검증' }).click();
    await trigger.hover();
    await expect(tooltip).toBeVisible();
    await tooltip.hover();
    await page.waitForTimeout(180);
    await expect(tooltip).toBeVisible();
  }
});

test('확인창 안 Tooltip의 Escape는 설명만 닫고 disabled control의 설명도 키보드로 읽힌다', async ({ page }) => {
  const wrapper = page.getByRole('button', { name: '제한된 작업', exact: true }).locator('..');
  await expect(wrapper).toHaveAttribute('tabindex', '0');
  await wrapper.focus();
  await expect(page.getByRole('tooltip')).toContainText('비활성 작업의 보조 설명');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '일반 확인창', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '공통 확인', exact: true });
  await dialog.getByRole('button', { name: '확인 설명', exact: true }).focus();
  await expect(page.getByRole('tooltip')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: '추가 정보', exact: true }).click();
  const popover = page.getByRole('dialog', { name: '추가 정보', exact: true });
  await popover.getByRole('button', { name: '보조 정보 설명' }).focus();
  await expect(page.getByRole('tooltip')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await expect(popover).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(popover).toHaveCount(0);
});

test('Popover은 제목·초기 focus·문서 링크 탐색·닫기 후 focus 복귀를 제공한다', async ({ page }) => {
  const trigger = page.getByRole('button', { name: '추가 정보', exact: true });
  await trigger.click();
  await expect(page.getByRole('dialog', { name: '추가 정보' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: '관련 문서' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('오류 field의 설명 id는 실제 본문에 연결되고 학부모 override 후에도 오류·focus가 보인다', async ({ page }) => {
  for (const label of ['텍스트', '긴 입력', '선택 입력']) {
    const input = page.getByLabel(label, { exact: true });
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    const ids = (await input.getAttribute('aria-describedby'))!.split(' ');
    for (const id of ids) expect(await page.evaluate((id) => Boolean(document.getElementById(id)), id)).toBe(true);
    expect(ids.some((id) => id.endsWith('-helper'))).toBe(false);
  }
  const field = page.getByLabel('학부모 입력', { exact: true });
  const shell = field.locator('..');
  await expect(shell).toHaveCSS('border-top-color', 'rgb(185, 28, 28)');
  await field.focus();
  await expect(shell).toHaveCSS('box-shadow', /3px/);
  await expect(shell).toHaveCSS('border-top-color', 'rgb(185, 28, 28)');
});

test('Tabs는 잠긴 항목을 건너뛰고 Accordion의 설명 연결과 펼침을 유지한다', async ({ page }) => {
  const first = page.getByRole('tab', { name: '첫 탭' });
  await first.focus();
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: '마지막 탭' })).toBeFocused();
  await expect(page.getByRole('tabpanel')).toHaveText('마지막 내용');
  await page.keyboard.press('Home');
  await expect(first).toBeFocused();
  await expect(page.getByRole('button', { name: '첫 설명' })).not.toHaveAttribute('aria-controls');
  await page.getByRole('button', { name: '첫 설명' }).click();
  await page.getByRole('button', { name: '다른 설명' }).click();
  const regions = page.getByRole('region');
  expect(await regions.nth(0).getAttribute('id')).not.toEqual(await regions.nth(1).getAttribute('id'));
  await expect(page.getByRole('region', { name: '첫 설명' })).toHaveText('첫 설명 본문');
});

test('Button과 ButtonLink의 hover·active·focus·disabled 표현은 레이아웃을 움직이지 않는다', async ({ page }, testInfo) => {
  const button = page.getByRole('button', { name: '기본 버튼', exact: true });
  const link = page.getByRole('link', { name: '이동 링크', exact: true });
  await expect(button).toHaveCSS('background-color', 'rgb(59, 91, 219)');
  await button.focus();
  await expect(button).toHaveCSS('outline-style', 'solid');
  await expect(button).toHaveCSS('outline-width', '2px');
  if (testInfo.project.name === 'desktop') {
    const before = await button.boundingBox();
    await button.hover();
    await expect(button).toHaveCSS('background-color', 'rgb(49, 79, 202)');
    expect(await button.boundingBox()).toEqual(before);
    await page.mouse.down();
    await expect(button).toHaveCSS('background-color', 'rgb(44, 70, 178)');
    await page.mouse.up();
    await link.hover();
    await expect(link).toHaveCSS('background-color', 'rgb(49, 79, 202)');
    const disabled = page.getByRole('button', { name: '비활성 버튼', exact: true });
    await disabled.hover();
    await expect(disabled).toHaveCSS('background-color', 'rgb(59, 91, 219)');
    await expect(disabled).toHaveCSS('opacity', '0.5');
  }
});

test('risk label·색 의미·대비를 유지하고 320px·reduced motion에서도 공통 UI가 읽힌다', async ({ page }) => {
  await expect(page.locator('.board-risk-badge')).toHaveText(['일반', '주의', '위험', '긴급']);
  const contrasts = await page.locator('.board-risk-badge').evaluateAll((badges) => {
    const luminance = (value: string) => {
      const channels = value.match(/[\d.]+/g)!.slice(0, 3).map(Number).map((n) => n / 255).map((n) => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4);
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    return badges.map((badge) => {
      const style = getComputedStyle(badge);
      const fg = luminance(style.color), bg = luminance(style.backgroundColor);
      return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
    });
  });
  for (const contrast of contrasts) expect(contrast).toBeGreaterThanOrEqual(4.5);
  await page.setViewportSize({ width: 320, height: 720 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.ui-button-spinner')).toHaveCSS('animation-duration', '0s');
  await expect(page.getByRole('button', { name: '전송 중' })).toHaveAttribute('aria-busy', 'true');
  await expect(page.getByRole('button', { name: '전송 중' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '기본 버튼' })).toHaveCSS('transition-duration', /0s/);
});
