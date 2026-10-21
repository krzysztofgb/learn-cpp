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

test('a compiler that cannot download says what to do next', async ({ page }) => {
  await page.route(/\/toolchain\//, (route) => route.abort());
  await page.goto('./playground');
  await page.getByRole('button', { name: 'Run' }).click();
  const panel = page.locator('.run-panel');
  await expect(panel).toContainText('Couldn’t download the compiler. Check your connection and run again', { timeout: 30_000 });
  await expect(panel.getByText('Details')).toBeVisible();
});
