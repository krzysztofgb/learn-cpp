import { expect, test } from '@playwright/test';

test('the home page says which notes are for Go developers', async ({ page }) => {
  await page.goto('./');
  const note = page.getByRole('complementary', { name: 'Coming from Go' });
  await expect(note).toBeVisible();
  await expect(note).toContainText('They are optional');
});
