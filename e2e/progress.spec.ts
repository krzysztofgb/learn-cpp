import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test('progress exports, resets and imports back', async ({ page }) => {
  await page.goto('./modules/02-pointers-references-arrays');
  const card = page.locator('#predict-P1');
  await card.getByRole('textbox').fill('40 10');
  await card.getByRole('button', { name: 'Commit and reveal' }).click();
  await expect(card.locator('.answer')).toBeVisible();

  await page.goto('./progress');
  const row = page.getByRole('row', { name: /2\. Pointers/ });
  await expect(row).toContainText('1/8');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export progress' }).click();
  const download = await downloadPromise;
  const exported = await readFile((await download.path())!, 'utf8');
  expect(JSON.parse(exported).modules['02-pointers-references-arrays'].predictions.P1.answer).toBe('40 10');

  page.on('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: 'Reset all' }).click();
  await expect(row).toContainText('0/8');

  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import…' }).click();
  await (await chooserPromise).setFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(exported) });
  await expect(page.getByRole('status')).toHaveText('Imported backup.json.');
  await expect(row).toContainText('1/8');
});

test('a bad import is rejected with a message', async ({ page }) => {
  await page.goto('./progress');
  page.on('dialog', (dialog) => void dialog.accept());
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import…' }).click();
  await (await chooserPromise).setFiles({ name: 'other.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
  await expect(page.getByRole('status')).toHaveText('This is not a learn-cpp progress file.');
});
