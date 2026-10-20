import { expect, test } from '@playwright/test';
import { finishedRunPanel } from './helpers.ts';

test('after one online compile, the course and compiler work offline', async ({ page, context }) => {
  await page.goto('./playground');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // The first visit installs the worker; reload so it controls the page and caches what the compile fetches.
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  await page.getByRole('button', { name: 'Run' }).click();
  await expect((await finishedRunPanel(page)).getByTestId('program-output')).toContainText('sum of 3 elements');

  await context.setOffline(true);
  await page.reload();
  await page.goto('./modules/19-lock-free-programming#predict');
  const card = page.locator('#predict-P1');
  await card.getByText('It prints…', { exact: true }).click();
  await card.getByRole('textbox', { name: 'Exact output' }).fill('0 5 5');
  await card.getByRole('button', { name: 'Commit and reveal' }).click();
  await card.getByRole('button', { name: 'Run' }).click();
  await expect((await finishedRunPanel(page, card)).getByTestId('program-output')).toHaveText('0 5 5');
});
