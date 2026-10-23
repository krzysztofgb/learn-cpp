import { expect, test } from '@playwright/test';
import { finishedRunPanel, setEditorSource } from './helpers.ts';

test.describe('module page', () => {
  test('a prediction unlocks Run only after committing, and runs to the answer key', async ({ page }) => {
    await page.goto('./modules/lock-free-programming#predict');
    const card = page.locator('#predict-P1');
    await expect(card.getByText('Answer first to run it.')).toBeVisible();
    await expect(card.getByRole('button', { name: 'Run' })).toHaveCount(0);

    await card.getByText('It prints…', { exact: true }).click();

    await card.getByRole('textbox', { name: 'Exact output' }).fill('0 5 5');
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
    await page.goto('./modules/types-and-initialization#exercises');
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
    await page.goto('./modules/probability-optional');
    await expect(page.locator('h1').getByText('Done', { exact: true })).toHaveCount(0);
    await page.goto('./modules/async-models#interview');
    const drill = page.locator('.drill');
    await expect(drill.locator('.dot').first()).toBeVisible();
    const total = await drill.locator('.dot').count();
    for (let i = 0; i < total; i++) {
      await drill.getByRole('button', { name: 'Reveal answer', exact: true }).click();
      await drill.getByRole('button', { name: 'Good', exact: true }).click();
    }
    await expect(page.locator('h1').getByText('Done', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.locator('h1').getByText('Done', { exact: true })).toBeVisible();
  });
});

test('an old numbered module URL redirects and keeps its tab', async ({ page }) => {
  await page.goto('./modules/19-lock-free-programming#predict');
  await expect(page).toHaveURL(/\/modules\/lock-free-programming#predict$/);
  await expect(page.getByRole('tab', { name: /Predict/ })).toHaveAttribute('aria-selected', 'true');
});

test('-Werror applies to your own code, not to course snippets that exist to warn', async ({ page }) => {
  await page.goto('./modules/types-and-initialization#predict');
  await page.getByRole('switch', { name: '-Werror on exercises' }).click();
  const card = page.locator('#predict-P1');
  await card.getByText('It prints…', { exact: true }).click();
  await card.getByRole('textbox', { name: 'Exact output' }).fill('0');
  await card.getByRole('button', { name: 'Commit and reveal' }).click();
  await card.getByRole('button', { name: 'Run' }).click();
  const panel = await finishedRunPanel(page, card);
  await expect(panel.getByTestId('program-output')).toHaveText('0');
  await expect(panel.locator('.diagnostics')).toContainText('comparison of integers of different signs');
  await expect(panel).not.toContainText('Compile error');
});

test.describe('answer controls', () => {
  test('a committed answer can be tried again, and a module reset clears it', async ({ page }) => {
    await page.goto('./modules/classes#predict');
    const card = page.locator('#predict-P2');
    await card.getByText("It doesn't compile", { exact: true }).click();
    await card.getByRole('button', { name: 'Commit and reveal' }).click();
    await expect(card.locator('.your-answer')).toContainText("It doesn't compile");

    await card.getByRole('button', { name: 'Try again' }).click();
    await expect(card.locator('.answer')).toHaveCount(0);
    await expect(card.getByText('Answer first to run it.')).toBeVisible();
    await expect(card.getByRole('radio').first()).toBeFocused();

    await card.getByText("It doesn't compile", { exact: true }).click();
    await card.getByRole('button', { name: 'Commit and reveal' }).click();
    await expect(page.getByRole('tab', { name: /^Predict/ })).toContainText('1/');
    await page.getByRole('button', { name: 'Reset module…' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Reset module' }).click();
    await expect(page.getByRole('tab', { name: /^Predict/ })).toContainText('0/');
    await expect(card.getByRole('button', { name: 'Commit and reveal' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset module…' })).toHaveCount(0);
  });

  test('an unsent prediction survives a look at the notes', async ({ page }) => {
    await page.goto('./modules/classes#predict');
    const card = page.locator('#predict-P2');
    await card.getByText('It prints…', { exact: true }).click();
    await card.getByRole('textbox', { name: 'Exact output' }).fill('my careful prediction');
    await page.getByRole('tab', { name: /^Notes/ }).click();
    await expect(card).toBeHidden();
    await page.getByRole('tab', { name: /^Predict/ }).click();
    await expect(card.getByRole('textbox', { name: 'Exact output' })).toHaveValue('my careful prediction');
  });

  test('a prose prediction takes free text and a bug item takes several findings', async ({ page }) => {
    await page.goto('./modules/operating-system#predict');
    const prose = page.locator('#predict-P1');
    await expect(prose.getByRole('radio')).toHaveCount(0);
    await prose.getByRole('textbox', { name: 'Your answer' }).fill('262,144 faults');
    await prose.getByRole('button', { name: 'Commit and reveal' }).click();
    await expect(prose.locator('.your-answer')).toContainText('262,144 faults');

    await page.getByRole('tab', { name: /Spot the bug/ }).click();
    const bug = page.locator('#ub-B1');
    const commit = bug.getByRole('button', { name: 'Commit and reveal' });
    await expect(commit).toBeDisabled();
    await bug.getByRole('checkbox', { name: 'Undefined behavior' }).check();
    await bug.getByRole('checkbox', { name: 'A bug, but defined behavior' }).check();
    await bug.getByRole('checkbox', { name: 'Nothing wrong' }).check();
    await expect(bug.getByRole('checkbox', { name: 'Undefined behavior' })).not.toBeChecked();
    await bug.getByRole('checkbox', { name: 'A bug, but defined behavior' }).check();
    await bug.getByRole('textbox').fill('printf and malloc are not async-signal-safe');
    await commit.click();
    await expect(bug.locator('.your-answer')).toContainText('A bug, but defined behavior. printf and malloc are not async-signal-safe');
  });
});
