import { expect, test } from '@playwright/test';
import { DEMO, openMenu, signInStaff } from './support';

test('the whole layout switches to Arabic and right-to-left', async ({ page }) => {
  await signInStaff(page, DEMO.owner);

  await page.getByRole('button', { name: 'Change language' }).click();
  await page.getByRole('menuitem', { name: 'العربية' }).click();

  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.getByRole('navigation').getByRole('link', { name: 'التذاكر' })).toBeVisible();

  await page.getByRole('button', { name: 'تغيير اللغة' }).click();
  await page.getByRole('menuitem', { name: 'English' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
});

test('an Arabic workspace opens in Arabic for its owner', async ({ page }) => {
  await signInStaff(page, DEMO.arabicOwner);
  await page.getByRole('button', { name: /Change language|تغيير اللغة/ }).click();
  await page.getByRole('menuitem', { name: 'العربية' }).click();
  await openMenu(page, 'التذاكر');
  await expect(page.getByRole('heading', { name: 'التذاكر' })).toBeVisible();
});

test('owners see developer tools, the audit log and branding settings', async ({ page }) => {
  await signInStaff(page, DEMO.owner);

  await openMenu(page, 'Developers');
  await expect(page.getByText('Order system sync')).toBeVisible();

  await openMenu(page, 'Audit log');
  await expect(page.getByRole('heading', { name: 'Audit log' })).toBeVisible();

  await openMenu(page, 'Workspace settings');
  await expect(page.getByLabel('Workspace name')).toHaveValue('BrightPath Software');
});

test('the platform admin runs the console without entering a workspace', async ({ page }) => {
  await signInStaff(page, DEMO.platformAdmin, /\/admin/);
  await expect(page.getByRole('heading', { name: 'Platform overview' })).toBeVisible();

  await page.getByRole('tab', { name: 'Workspaces' }).click();
  await page.getByLabel(/Search name, address/).fill('brightpath');
  await page.getByRole('link', { name: 'BrightPath Software' }).click();
  await expect(page.getByText(/read-only overview/)).toBeVisible();

  await page.goto('/app/tickets');
  await expect(page).toHaveURL(/\/admin/);
});
