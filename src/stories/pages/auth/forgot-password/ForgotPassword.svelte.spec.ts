import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import ForgotPassword from './ForgotPassword.svelte';

describe('ForgotPassword', () => {
	it('renders the Forgot password heading', async () => {
		render(ForgotPassword);
		await expect.element(page.getByRole('heading', { level: 1 })).toHaveTextContent('Forgot password');
	});

	it('renders the email field', async () => {
		render(ForgotPassword);
		await expect.element(page.getByLabelText('Email')).toBeVisible();
	});

	it('renders the send reset link button', async () => {
		render(ForgotPassword);
		await expect.element(page.getByRole('button', { name: 'Send reset link' })).toBeVisible();
	});

	it('renders a link back to sign in', async () => {
		render(ForgotPassword);
		const link = page.getByRole('link', { name: 'Back to sign in' });
		await expect.element(link).toBeVisible();
		expect(link.element().getAttribute('href')).toBe('/auth/signin');
	});
});
