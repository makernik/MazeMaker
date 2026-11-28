/**
 * E2E smoke test: playable maze and print sheet.
 *
 * Verifies the app loads on a maze, Print opens the pack sheet, and Generate downloads a PDF.
 */

import { test, expect } from '@playwright/test';

test.describe('Generate PDF flow', () => {
  test('app loads on a playable maze', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Maze Generator' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Print' })).toBeVisible();
    await expect(page.getByText('Draw the path')).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Print' })).toHaveCount(0);
    await expect(page.getByRole('radio', { name: /Easy/ })).toBeChecked();
  });

  test('print sheet generates a PDF', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Print', exact: true }).click();

    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await page.getByRole('button', { name: 'Generate Printable PDF' }).click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^mazes-.+-\d+pk\.pdf$/);
  });

  test('status shows success after generation', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Print', exact: true }).click();

    page.waitForEvent('download', { timeout: 30000 }).catch(() => {});

    await page.getByRole('button', { name: 'Generate Printable PDF' }).click();

    await expect(page.getByText(/Downloaded \d+ maze/)).toBeVisible({ timeout: 15000 });
  });

  test('changing level keeps a playable maze', async ({ page }) => {
    await page.goto('/');

    const canvas = page.locator('#sample-preview-canvas');
    await expect(canvas).toBeVisible();

    await page.getByRole('radio', { name: /Hard/ }).click();

    await expect(page.getByRole('radio', { name: /Hard/ })).toBeChecked();
    await expect(canvas).toBeVisible();
    await expect(page.getByText('Draw the path')).toBeVisible();
  });
});
