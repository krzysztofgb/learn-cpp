import { expect, test } from '@playwright/test';

test('a due question is reviewed under the page heading and leaves the queue once graded', async ({ page }) => {
  await page.addInitScript(() => {
    const due = { grade: 'again', at: 0, interval: 0, due: 0 };
    const progress = { version: 2, modules: { 'async-models': { predictions: {}, ub: {}, exercises: {}, questions: { Q1: due } } } };
    if (!localStorage.getItem('learn-cpp/progress')) localStorage.setItem('learn-cpp/progress', JSON.stringify(progress));
  });
  await page.goto('./review');
  await expect(page.getByRole('heading', { level: 2, name: 'Module 20, question 1' })).toBeVisible();

  await page.getByRole('button', { name: 'Reveal answer', exact: true }).click();
  await page.getByRole('button', { name: 'Good', exact: true }).click();
  await expect(page.getByText('Reviewed 1. Nothing else is due.')).toBeVisible();
});
