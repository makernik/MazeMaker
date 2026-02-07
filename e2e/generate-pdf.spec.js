/**
 * E2E smoke test: generate PDF flow
 *
 * Verifies the app loads, the generate button works, and a PDF download is triggered.
 */

import { test, expect } from '@playwright/test';

test.describe('Generate PDF flow', () => {
  test('app loads and shows controls', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Maze Generator' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Generate Printable PDF' })).toBeVisible();
  });

  test('clicking Generate triggers PDF download', async ({ page }) => {
    await page.goto('/');

    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });

    await page.getByRole('button', { name: 'Generate Printable PDF' }).click();

    const download = await downloadPromise;
    // Filename: mazes-{ageRange}-{quantity}pk.pdf (e.g. mazes-3-5-5pk.pdf or mazes-9-13-1pk.pdf)
    expect(download.suggestedFilename()).toMatch(/^mazes-\d+-\d+-\d+pk\.pdf$/);
  });

  test('status shows success after generation', async ({ page }) => {
    await page.goto('/');

    page.waitForEvent('download', { timeout: 30000 }).catch(() => {});

    await page.getByRole('button', { name: 'Generate Printable PDF' }).click();

    await expect(page.getByText(/Downloaded \d+ maze/)).toBeVisible({ timeout: 15000 });
  });
});
