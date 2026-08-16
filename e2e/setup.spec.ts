import { test, expect } from '@playwright/test';
import { gotoHydrated } from './helpers';

test('application setup flow', async ({ page }) => {
  await gotoHydrated(page, '/setup');
  await expect(async () => {
    await page.getByRole('button', { name: 'Test Connection' }).click();
    await expect(page.getByText('Connected successfully.')).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Continue →' }).click();
  await page.getByRole('button', { name: 'Initialize Database' }).click();
  await page.getByRole('button', { name: 'Continue →' }).click();
  await expect(page.getByRole('textbox', { name: 'Base URL' })).toHaveValue('http://localhost:5173');
  await expect(page.getByRole('textbox', { name: 'Application Name' })).toHaveValue('TurfBuilder');
  await page.getByRole('button', { name: 'Save & Continue →' }).click();
  await page.getByRole('button', { name: 'Skip' }).click();
  await page.getByRole('textbox', { name: 'Full Name' }).click();
  await page.getByRole('textbox', { name: 'Full Name' }).fill('Test McGee');
  await page.getByRole('textbox', { name: 'Username' }).click();
  await page.getByRole('textbox', { name: 'Username' }).fill('testmcgee');
  await page.getByRole('textbox', { name: 'Email Address' }).click();
  await page.getByRole('textbox', { name: 'Email Address' }).fill('test@example.com');
  await page.getByRole('textbox', { name: 'Password', exact: true }).click();
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('Password123');
  await page.getByRole('textbox', { name: 'Confirm Password' }).click();
  await page.getByRole('textbox', { name: 'Confirm Password' }).fill('Password123');
  await page.getByRole('button', { name: 'Create Admin Account' }).click();
  await expect(page.locator('body')).toMatchAriaSnapshot(`
    - img "Logo"
    - text: Email or Username
    - textbox "Email or Username"
    - text: Password
    - link "Forgot password?":
      - /url: /auth/forgot-password
    - textbox "Password"
    - button "Show password":
      - img
    - button "Sign In"
    - paragraph:
      - text: Don't have an account?
      - link "Sign up":
        - /url: /auth/signup
    - link "Privacy Policy":
      - /url: /privacy
    - link "Terms of Service":
      - /url: /terms
    `);
});