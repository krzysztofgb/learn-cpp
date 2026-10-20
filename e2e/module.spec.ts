import { expect, test } from '@playwright/test';
import { finishedRunPanel, setEditorSource } from './helpers.ts';

test.describe('module page', () => {
  test('a prediction unlocks Run only after committing, and runs to the answer key', async ({ page }) => {
    await page.goto('./modules/19-lock-free-programming');
    const card = page.locator('#predict-P1');
    await expect(card.getByText('Answer first to run it.')).toBeVisible();
    await expect(card.getByRole('button', { name: 'Run' })).toHaveCount(0);

    await card.getByRole('textbox').fill('0 5 5');
    await card.getByRole('button', { name: 'Commit and reveal' }).click();
    await expect(card.locator('.answer')).toContainText('The CAS fails');

    await card.getByRole('button', { name: 'Run' }).click();
    const panel = card.locator('.run-panel');
    await expect(panel).toHaveAttribute('aria-busy', 'false');
    await expect(panel.getByTestId('program-output')).toHaveText('0 5 5');

    const godbolt = card.getByRole('link', { name: /Compiler Explorer/ });
    await expect(godbolt).toHaveAttribute('href', /^https:\/\/godbolt\.org\/clientstate\//);
  });

  test('an exercise solution runs with UBSan and is kept after a reload', async ({ page }) => {
    await page.goto('./modules/01-types-and-initialization');
    const exercise = page.locator('#exercise-E3');
    await exercise.getByText('Your solution').click();
    await setEditorSource(page, '#include <climits>\nint main(int argc, char**) { int x = INT_MAX; return x + argc; }', exercise);
    await exercise.getByRole('button', { name: 'Run' }).click();
    const panel = await finishedRunPanel(page, exercise);
    await expect(panel).toContainText('UB detected (UBSan trap)');

    await page.waitForTimeout(700); // autosave debounce
    await page.reload();
    await page.locator('#exercise-E3').getByText('Your solution').click();
    await expect(page.locator('#exercise-E3 .cm-content')).toContainText('INT_MAX');
  });

  test('grading every interview question marks the module done', async ({ page }) => {
    await page.goto('./modules/30-probability-optional');
    await expect(page.locator('h1')).not.toContainText('Done');
    await page.goto('./modules/20-async-models');
    const drill = page.locator('.drill');
    await expect(drill.locator('.dot').first()).toBeVisible();
    const total = await drill.locator('.dot').count();
    for (let i = 0; i < total; i++) {
      await drill.getByRole('button', { name: 'Reveal answer', exact: true }).click();
      await drill.getByRole('button', { name: 'Good', exact: true }).click();
    }
    await expect(page.locator('h1 .done-badge')).toHaveText('Done');
    await page.reload();
    await expect(page.locator('h1 .done-badge')).toHaveText('Done');
  });
});
