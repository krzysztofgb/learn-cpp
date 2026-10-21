import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test('progress exports, resets and imports back', async ({ page }) => {
  await page.goto('./modules/pointers-references-arrays#predict');
  const card = page.locator('#predict-P1');
  await card.getByText('It prints…', { exact: true }).click();
  await card.getByRole('textbox', { name: 'Exact output' }).fill('40 10');
  await card.getByRole('button', { name: 'Commit and reveal' }).click();
  await expect(card.locator('.answer')).toBeVisible();

  await page.goto('./progress');
  const row = page.getByRole('row', { name: /Pointers, references/ });
  await expect(row).toContainText('1/8');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export progress' }).click();
  const download = await downloadPromise;
  const exported = await readFile((await download.path())!, 'utf8');
  expect(JSON.parse(exported).modules['pointers-references-arrays'].predictions.P1.answer).toBe('Prints: 40 10');

  await page.getByRole('button', { name: 'Reset all' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete progress' }).click();
  await expect(row).toContainText('0/8');

  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import…' }).click();
  await (await chooserPromise).setFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(exported) });
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('backup.json: 1 module started, 1 answer');
  await dialog.getByRole('button', { name: 'Replace progress' }).click();
  await expect(page.getByRole('status')).toContainText('Imported backup.json');
  await expect(row).toContainText('1/8');
});

test('a bad import is rejected with a message', async ({ page }) => {
  await page.goto('./progress');
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import…' }).click();
  await (await chooserPromise).setFiles({ name: 'other.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
  await expect(page.getByRole('status')).toContainText('This is not a learn-cpp progress file.');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
