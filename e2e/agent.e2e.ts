import { expect, test } from '@playwright/test';
import { DEMO, openMenu, signInStaff, unique } from './support';

test('an agent records a ticket, adds a note and finds it again', async ({ page }) => {
  const subject = unique('Printer jam on floor 3');
  await signInStaff(page, DEMO.agent);

  await openMenu(page, 'Tickets');
  await page.getByRole('link', { name: 'New ticket' }).click();
  await page.getByLabel('Subject').fill(subject);
  await page.getByLabel('Description').fill('The printer on floor 3 jams on every second page.');
  await page.getByLabel('Customer email').fill('e2e.customer@customers.demo');
  await page.getByRole('button', { name: 'Create ticket' }).click();

  await expect(page.getByRole('heading', { name: subject })).toBeVisible();
  await page.getByRole('radio', { name: 'Internal note' }).click();
  await page
    .getByRole('textbox', { name: /Note for your team/ })
    .fill('Checked the toner, it is fine.');
  await page.getByRole('button', { name: 'Add note' }).click();
  await expect(page.getByText('Checked the toner, it is fine.')).toBeVisible();

  await openMenu(page, 'Tickets');
  await page
    .getByRole('searchbox')
    .or(page.getByLabel(/Search/))
    .first()
    .fill(subject);
  await expect(page.getByRole('link', { name: subject })).toBeVisible();
});

test('the dashboard and reports show the seeded history and export it', async ({ page }) => {
  await signInStaff(page, DEMO.owner);
  await expect(page.getByRole('heading', { name: 'Welcome, Sarah Mitchell' })).toBeVisible();

  await openMenu(page, 'Reports');
  await expect(page.getByRole('img', { name: 'Ticket volume' })).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Key figures' }).getByText('Tickets created'),
  ).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  await page.getByRole('menuitem').first().click();
  expect((await download).suggestedFilename()).toMatch(/\.csv$/);
});
