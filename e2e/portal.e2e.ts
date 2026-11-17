import { expect, test } from '@playwright/test';
import { DEMO, signInCustomer, unique } from './support';

test('the branded help centre answers questions from its articles', async ({ page }) => {
  await page.goto(`/portal/${DEMO.portal}`);

  await expect(
    page.getByRole('heading', { name: /How can BrightPath Software help/ }),
  ).toBeVisible();
  await page.getByLabel('Search help articles').fill('invoice');
  await expect(page.getByRole('link', { name: 'Download an invoice' })).toBeVisible();
  await page.getByRole('link', { name: 'Download an invoice' }).click();
  await expect(page.getByRole('heading', { name: 'Download an invoice' })).toBeVisible();
});

test('a customer sends a request and follows it in the portal', async ({ page }) => {
  const subject = unique('Cannot export my data');
  await signInCustomer(page);

  await page.getByRole('link', { name: 'New request' }).first().click();
  await page.getByLabel('Subject').fill(subject);
  await page.getByLabel('How can we help?').fill('The export button spins forever.');
  await page.getByRole('button', { name: 'Send request' }).click();

  await expect(page.getByRole('heading', { name: subject })).toBeVisible();
  await page.getByRole('link', { name: 'My requests' }).first().click();
  await expect(page.getByRole('link', { name: subject })).toBeVisible();
});
