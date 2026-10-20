import { expect, test } from '@playwright/test';
import { finishedRunPanel, setEditorSource } from './helpers.ts';

test.describe('playground', () => {
  test('compiles and runs C++23, then flags signed overflow as UB', async ({ page }) => {
    await page.goto('./playground');
    await page.getByRole('button', { name: 'Run' }).click();
    const panel = await finishedRunPanel(page);
    await expect(panel.getByTestId('program-output')).toContainText('sum of 3 elements');
    await expect(panel).toContainText('UB detected (UBSan trap)');
  });

  test('reports compile errors, uncaught exceptions and timeouts', async ({ page }) => {
    await page.goto('./playground');
    const run = page.getByRole('button', { name: 'Run' });

    await setEditorSource(page, 'int main() { return x; }');
    await run.click();
    let panel = await finishedRunPanel(page);
    await expect(panel).toContainText('Compile error');
    await expect(panel).toContainText("use of undeclared identifier 'x'");

    await setEditorSource(page, '#include <stdexcept>\nint main() { throw std::runtime_error("boom"); }');
    await run.click();
    panel = await finishedRunPanel(page);
    await expect(panel).toContainText('Uncaught exception: std::terminate');
    await expect(panel).toContainText('uncaught exception of type std::runtime_error: boom');

    await setEditorSource(page, '#include <cstdio>\nint main() { std::puts("start"); for (;;) {} }');
    await run.click();
    panel = await finishedRunPanel(page);
    await expect(panel).toContainText('Timed out');
    await expect(panel.getByTestId('program-output')).toContainText('start');
  });
});
