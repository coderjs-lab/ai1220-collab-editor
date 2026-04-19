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

async function login(page: Page, identity: {
  email: string;
  password: string;
}) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(identity.email);
  await page.getByLabel('Password').fill(identity.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/documents$/);
}

async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
}

test('owner can log in and accept an AI suggestion into the collaborative editor', async ({ page }) => {
  const unique = Date.now() - 1;
  const owner = {
    username: `ailogin${unique}`,
    email: `ailogin${unique}@example.com`,
    password: 'password123',
  };

  await register(page, owner);
  await signOut(page);
  await login(page, owner);

  await page.getByLabel('Document title').fill('AI login acceptance draft');
  await page.getByRole('button', { name: 'Create document' }).click();
  await expect(page).toHaveURL(/\/documents\/\d+$/);

  const editor = page.getByTestId('collaborative-editor-content');
  await editor.click();
  await editor.pressSequentially('Login flow content. Assistant should help refine this draft.');

  await page.getByRole('button', { name: 'Assistant' }).click();
  await page.getByLabel('AI action').selectOption('summarize');
  await page.getByLabel('Summary length').selectOption('short');
  await page.getByLabel('Summary format').selectOption('paragraph');
  await page.getByLabel('Context scope').selectOption('section');
  await page.getByRole('button', { name: 'Generate' }).click();

  const suggestion = page.getByRole('textbox', { name: 'Suggestion' });
  await expect.poll(async () => (await suggestion.inputValue()).trim().length).toBeGreaterThan(0);
  const generatedSuggestion = (await suggestion.inputValue()).trim();
  const expectedSnippet = generatedSuggestion.slice(0, Math.min(24, generatedSuggestion.length));

  await page.getByRole('button', { name: 'Replace draft' }).click();
  await expect(editor).toContainText(expectedSnippet);
});

test('owner can stream an AI summary and apply it to the collaborative editor', async ({ page }) => {
  const unique = Date.now();
  const owner = {
    username: `aiowner${unique}`,
    email: `aiowner${unique}@example.com`,
    password: 'password123',
  };

  await register(page, owner);
  await page.getByLabel('Document title').fill('AI assistant E2E Draft');
  await page.getByRole('button', { name: 'Create document' }).click();
  await expect(page).toHaveURL(/\/documents\/\d+$/);

  const editor = page.getByTestId('collaborative-editor-content');
  await editor.click();
  await editor.pressSequentially('First sentence. Second sentence. Third sentence.');

  await page.getByRole('button', { name: 'Assistant' }).click();
  await page.getByLabel('AI action').selectOption('summarize');
  await page.getByLabel('Summary length').selectOption('short');
  await page.getByLabel('Summary format').selectOption('paragraph');
  await page.getByLabel('Context scope').selectOption('section');
  await page.getByRole('button', { name: 'Generate' }).click();

  const suggestion = page.getByRole('textbox', { name: 'Suggestion' });
  await expect.poll(async () => (await suggestion.inputValue()).trim().length).toBeGreaterThan(0);
  const generatedSuggestion = (await suggestion.inputValue()).trim();
  const expectedSnippet = generatedSuggestion.slice(0, Math.min(24, generatedSuggestion.length));

  await page.getByRole('button', { name: 'Replace draft' }).click();
  await expect(editor).toContainText(expectedSnippet);
});

test('owner can partially accept a highlighted AI suggestion fragment', async ({ page }) => {
  const unique = Date.now() + 1;
  const owner = {
    username: `aipartial${unique}`,
    email: `aipartial${unique}@example.com`,
    password: 'password123',
  };

  await register(page, owner);
  await page.getByLabel('Document title').fill('AI partial acceptance draft');
  await page.getByRole('button', { name: 'Create document' }).click();
  await expect(page).toHaveURL(/\/documents\/\d+$/);

  const editor = page.getByTestId('collaborative-editor-content');
  await editor.click();
  await editor.pressSequentially('Alpha beta gamma. Delta epsilon zeta.');

  await page.getByRole('button', { name: 'Assistant' }).click();
  await page.getByLabel('AI action').selectOption('rewrite');
  await page.getByLabel('Context scope').selectOption('section');
  await page.getByRole('button', { name: 'Generate' }).click();

  const suggestion = page.getByRole('textbox', { name: 'Suggestion' });
  await expect.poll(async () => (await suggestion.inputValue()).trim().length).toBeGreaterThan(0);

  const selectedFragment = await suggestion.evaluate((element: HTMLTextAreaElement) => {
    const value = element.value;
    const safeStart = 0;
    const safeEnd = Math.min(value.length, 11);
    element.focus();
    element.setSelectionRange(safeStart, safeEnd);
    element.dispatchEvent(new Event('select', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    return value.slice(safeStart, safeEnd).trim();
  });

  await page.getByRole('button', { name: 'Accept selected text' }).click();
  await page.getByText('Partial acceptance').click();
  await page.getByRole('button', { name: 'Append accepted below' }).click();
  await expect(editor).toContainText(selectedFragment);
});
