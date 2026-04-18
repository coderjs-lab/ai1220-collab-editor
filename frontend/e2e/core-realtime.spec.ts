import { expect, test, type Page } from '@playwright/test';

async function register(page: Page, identity: {
  username: string;
  email: string;
  password: string;
}) {
  await page.goto('/register');
  await page.getByLabel('Username').fill(identity.username);
  await page.getByLabel('Email').fill(identity.email);
  await page.getByLabel('Password').fill(identity.password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/documents$/);
}

test('owner can share by link and collaborate with a second editor in real time', async ({
  browser,
}) => {
  const unique = Date.now();
  const owner = {
    username: `owner${unique}`,
    email: `owner${unique}@example.com`,
    password: 'password123',
  };
  const guest = {
    username: `guest${unique}`,
    email: `guest${unique}@example.com`,
    password: 'password123',
  };

  const ownerContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  const guestPage = await guestContext.newPage();

  await register(ownerPage, owner);
  await ownerPage.getByLabel('Document title').fill('Realtime E2E Draft');
  await ownerPage.getByRole('button', { name: 'Create document' }).click();
  await expect(ownerPage).toHaveURL(/\/documents\/\d+$/);
  await expect(ownerPage.getByLabel('Title')).toHaveValue('Realtime E2E Draft');

  await ownerPage.getByLabel('Link role').selectOption('editor');
  await ownerPage.getByRole('button', { name: 'Create link' }).click();
  const shareLinkText = await ownerPage
    .locator('text=/\\/share\\//')
    .first()
    .textContent();
  expect(shareLinkText).toBeTruthy();

  await register(guestPage, guest);
  await guestPage.goto(String(shareLinkText));
  await expect(guestPage).toHaveURL(/\/documents\/\d+$/);
  await expect(guestPage.getByTestId('collaborative-editor-content')).toBeVisible();

  const ownerEditor = ownerPage.getByTestId('collaborative-editor-content');
  await ownerEditor.click();
  await ownerEditor.pressSequentially('Hello from owner');

  await expect(guestPage.getByTestId('collaborative-editor-content')).toContainText(
    'Hello from owner',
  );

  await ownerPage.waitForTimeout(1800);
  await ownerPage.reload();
  await expect(ownerPage.getByTestId('collaborative-editor-content')).toContainText(
    'Hello from owner',
  );

  await ownerContext.close();
  await guestContext.close();
});
