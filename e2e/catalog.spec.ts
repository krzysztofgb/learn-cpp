import { expect, test } from '@playwright/test';

test('the catalog renders cards as they come into view, and a filter shows its module at once', async ({ page }) => {
  await page.goto('./catalog');
  await expect(page.getByText('0 of 154 answered')).toBeVisible();
  expect(await page.locator('#main .card').count()).toBeLessThan(154);

  await page.getByRole('combobox', { name: 'Module' }).click();
  await page.getByRole('option', { name: '26. Trading domain' }).click();
  await expect(page.getByRole('heading', { level: 2, name: '26. Trading domain' })).toBeVisible();
  await expect(page.locator('#main .card').first()).toBeVisible();
});
