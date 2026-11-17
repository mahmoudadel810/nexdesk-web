import { Page, expect } from '@playwright/test';

/** The password every seeded demo account shares. */
export const DEMO_PASSWORD = 'NexDesk-demo-2026';

export const DEMO = {
  owner: 'sarah@brightpath.demo',
  agent: 'maya@brightpath.demo',
  arabicOwner: 'layla@souqna.demo',
  platformAdmin: 'admin@nexdesk.demo',
  customer: 'casey@customers.demo',
  portal: 'brightpath',
} as const;

/** A label no seeded record or earlier run uses, so a test only ever finds what it made. */
export function unique(prefix: string): string {
  return `${prefix} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export async function signInStaff(
  page: Page,
  email: string,
  expectedPath = /\/app/,
): Promise<void> {
  await page.goto('/auth/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(expectedPath);
}

export async function signInCustomer(page: Page): Promise<void> {
  await page.goto(`/portal/${DEMO.portal}/login`);
  await page.getByLabel('Email').fill(DEMO.customer);
  await page.getByLabel('Password', { exact: true }).fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('link', { name: 'My requests' }).first()).toBeVisible();
}

/** Opens a main menu entry by its visible name. */
export async function openMenu(page: Page, name: string): Promise<void> {
  await page.getByRole('navigation').getByRole('link', { name, exact: true }).click();
}
