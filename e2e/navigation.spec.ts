import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 375, height: 812 } });

test('the phone menu is a modal dialog that hands focus back on Escape', async ({ page }) => {
  await page.goto('./');
  const toggle = page.getByRole('button', { name: 'Open menu' });
  await toggle.click();

  const menu = page.getByRole('dialog', { name: 'Menu' });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Close menu' })).toBeFocused();
  await expect(page.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('inert', '');

  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(toggle).toBeFocused();
});
