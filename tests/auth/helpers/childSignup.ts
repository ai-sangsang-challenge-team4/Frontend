import type { Page } from '@playwright/test';

// Mock signup option IDs (mockSignupOptionsApi): 상상초등학교 = 1, 6학년 2반 = 1062, 17번 = 106217.
export const MOCK_CHILD = { schoolId: 1, schoolClassId: 1062, studentId: 106217 } as const;

export async function fillChildInformation(page: Page) {
  await page.getByRole('combobox', { name: '학교', exact: true }).fill('상상초등');
  await page.getByRole('option', { name: '상상초등학교 예시 학교' }).click();
  await page.getByLabel('학년', { exact: true }).selectOption('6');
  await page.getByLabel('반', { exact: true }).selectOption({ label: '2반' });
  await page.getByLabel('번호', { exact: true }).selectOption({ label: '17번' });
  await page.getByLabel('자녀 이름').fill('  김상상  ');
}
