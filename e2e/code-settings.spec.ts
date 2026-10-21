import { expect, test } from '@playwright/test';

test('code settings change every snippet and editor, and are remembered', async ({ page }) => {
  await page.goto('./modules/lock-free-programming#ub');
  const code = page.locator('#ub-U2 .code-static');
  await expect(code).toHaveClass(/numbered/);
  await expect(code).toHaveClass(/wrap/);

  await page.locator('#ub-U2').getByRole('button', { name: 'Code settings' }).click();
  const panel = page.getByRole('dialog', { name: 'Code settings' });
  await panel.getByRole('switch', { name: 'Line numbers' }).click();
  await panel.getByRole('switch', { name: 'Wrap long lines' }).click();
  await panel.getByRole('button', { name: 'Large' }).click();
  await expect(code).not.toHaveClass(/numbered/);
  await expect(code).not.toHaveClass(/wrap/);
  await expect(code).toHaveCSS('font-size', '15px');
  await page.keyboard.press('Escape');

  await page.reload();
  await expect(page.locator('#ub-U2 .code-static')).not.toHaveClass(/numbered/);

  await page.goto('./playground');
  await expect(page.locator('.cm-editor')).toHaveCSS('font-size', '15px');
  await expect(page.locator('.cm-lineNumbers')).toHaveCount(0);
  await expect(page.locator('.cm-content')).not.toHaveClass(/cm-lineWrapping/);

  await page.getByRole('button', { name: 'Code settings' }).click();
  await page.getByRole('dialog', { name: 'Code settings' }).getByRole('button', { name: 'Reset to defaults' }).click();
  await expect(page.locator('.cm-lineNumbers')).toHaveCount(1);
  await expect(page.locator('.cm-content')).toHaveClass(/cm-lineWrapping/);
});

test('vim key bindings load when chosen', async ({ page }) => {
  await page.goto('./playground');
  await expect(page.locator('.cm-content')).toContainText('#include <climits>');
  await page.getByRole('button', { name: 'Code settings' }).click();
  await page.getByRole('dialog', { name: 'Code settings' }).getByRole('button', { name: 'Vim' }).click();
  await page.keyboard.press('Escape');

  await page.locator('.cm-content').click();
  await expect(page.locator('.cm-fat-cursor')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.type('ggdd');
  await expect(page.locator('.cm-content')).not.toContainText('#include <climits>');

  await page.getByRole('button', { name: 'Code settings' }).click();
  await page.getByRole('dialog', { name: 'Code settings' }).getByRole('button', { name: 'Standard' }).click();
  await expect(page.locator('.cm-fat-cursor')).toHaveCount(0);
});
