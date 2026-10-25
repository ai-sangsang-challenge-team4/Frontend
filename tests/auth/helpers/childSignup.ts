import type { Page } from '@playwright/test';

export async function fillChildInformation(page: Page) {
  await page.getByRole('combobox', { name: '학교', exact: true }).fill('상상초등');
  await page.getByRole('option', { name: '상상초등학교 예시 학교' }).click();
  await page.getByLabel('학년', { exact: true }).selectOption('6');
  await page.getByLabel('반', { exact: true }).selectOption('2');
  await page.getByLabel('번호', { exact: true }).selectOption('17');
  await page.getByLabel('자녀 이름').fill('  김상상  ');
}
