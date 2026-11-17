import { expect, test } from '@playwright/test';
import { DEMO, openMenu, signInStaff, unique } from './support';

test('an agent records a ticket, adds a note and finds it again', async ({ page }) => {
  const subject = unique('Printer jam on floor 3');
  await signInStaff(page, DEMO.agent);

  await openMenu(page, 'Tickets');
  await page.getByRole('link', { name: 'New ticket' }).click();
  await expect(page.getByRole('heading', { name: 'New ticket' })).toBeVisible();
  await page.getByLabel('Subject').fill(subject);
  await page.getByLabel('Description').fill('The printer on floor 3 jams on every second page.');
  await page.getByLabel('Customer email').fill('e2e.customer@customers.demo');
  await page.getByRole('button', { name: 'Create ticket' }).click();

  await expect(page.getByRole('heading', { name: subject })).toBeVisible();
  await page.getByRole('radio', { name: 'Internal note' }).click();
  // The composer suggests teammates after "@", so it is a combobox rather than a plain text box.
  const composer = page.getByRole('combobox', { name: /Note for your team/ });
  await composer.fill('Checked the toner, it is fine. ');
  await composer.pressSequentially('@tom');
  await page.getByRole('option', { name: 'Tom Okafor' }).click();
  await composer.pressSequentially('can you order a new drum?');
  await page.getByRole('button', { name: 'Add note' }).click();
  const note = page.locator('.message.internal').last();
  await expect(note).toContainText(
    'Checked the toner, it is fine. @Tom Okafor can you order a new drum?',
  );
  await expect(note.locator('.mention')).toHaveText('@Tom Okafor');

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
