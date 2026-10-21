import { expect, test } from '@playwright/test';

// The service worker would serve cached chunks; block it so the failed download is real.
test.use({ serviceWorkers: 'block' });

test('a page whose code fails to download shows a recoverable error inside the app', async ({ page }) => {
  await page.route(/\/assets\/lock-free-programming-[^/]+\.js$/, (route) => route.abort());
  await page.goto('./modules/lock-free-programming');
  await expect(page.getByRole('heading', { name: "This page didn't load" })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Course modules' })).toBeAttached();
  await expect(page.getByText('Unexpected Application Error')).toHaveCount(0);

  await page.getByRole('link', { name: 'Go to the course home' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('C++ for Low-Latency Systems');
});
