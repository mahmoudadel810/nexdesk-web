import { Page, expect, test } from '@playwright/test';
import { DEMO, openMenu, signInCustomer, signInStaff } from './support';

/**
 * Captures the README screenshots from a stack with the demo data seeded. Run with
 * `npm run screenshots`; the images land in docs/screenshots.
 */
const shot = async (page: Page, name: string) => {
  // Let charts finish their entrance animation and fonts settle before capturing.
  await page.waitForTimeout(900);
  await page.screenshot({ path: `docs/screenshots/${name}.png` });
};

test.use({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });

test('agent workspace', async ({ page }) => {
  await signInStaff(page, DEMO.owner);
  await expect(page.getByRole('heading', { name: 'Welcome, Sarah Mitchell' })).toBeVisible();
  await shot(page, 'dashboard');

  await openMenu(page, 'Tickets');
  await expect(page.getByRole('table')).toBeVisible();
  await shot(page, 'tickets');

  await page.getByRole('table').getByRole('link').first().click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await shot(page, 'ticket');

  await openMenu(page, 'Reports');
  await expect(page.getByRole('img', { name: 'Ticket volume' })).toBeVisible();
  await shot(page, 'reports');

  await openMenu(page, 'SLA');
  await shot(page, 'sla');

  await openMenu(page, 'Automation');
  await page.getByRole('link', { name: /Solve requests that wait/ }).click();
  await shot(page, 'automation');

  await openMenu(page, 'Developers');
  await expect(page.getByText('Order system sync')).toBeVisible();
  await shot(page, 'developers');

  await openMenu(page, 'Audit log');
  await page.locator('mat-expansion-panel').first().click();
  await shot(page, 'audit-log');

  await openMenu(page, 'Workspace settings');
  await shot(page, 'settings');
});

test('dark mode and Arabic', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await signInStaff(page, DEMO.owner);
  await openMenu(page, 'Tickets');
  await expect(page.getByRole('table')).toBeVisible();
  await shot(page, 'tickets-dark');

  await page.getByRole('button', { name: 'Change language' }).click();
  await page.getByRole('menuitem', { name: 'العربية' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await openMenu(page, 'التقارير');
  await expect(page.getByRole('img').first()).toBeVisible();
  await shot(page, 'reports-arabic');
});

test('customer portal', async ({ page }) => {
  await page.goto(`/portal/${DEMO.portal}`);
  await expect(
    page.getByRole('heading', { name: /How can BrightPath Software help/ }),
  ).toBeVisible();
  await shot(page, 'portal');

  await signInCustomer(page);
  await page.getByRole('link', { name: 'My requests' }).first().click();
  await shot(page, 'portal-requests');

  await page.goto('/portal/souqna');
  await shot(page, 'portal-arabic');
});

test('platform console and landing page', async ({ page }) => {
  await page.goto('/');
  await shot(page, 'landing');

  await signInStaff(page, DEMO.platformAdmin, /\/admin/);
  await expect(page.getByRole('heading', { name: 'Platform overview' })).toBeVisible();
  await shot(page, 'admin');
});
