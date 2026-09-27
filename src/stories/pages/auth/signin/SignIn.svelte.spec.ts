import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import SignIn from './SignIn.svelte';

describe('SignIn', () => {
	// The page shows the logo rather than a heading (AuthLayout renders a title
	// only when the logo is hidden).
	it('shows the logo', async () => {
		render(SignIn);
		await expect.element(page.getByRole('img', { name: 'Logo' })).toBeVisible();
	});

	it('renders the identifier and password fields', async () => {
		render(SignIn);
		await expect.element(page.getByLabelText('Email or Username')).toBeVisible();
		// Exact: the field's "Show password" toggle also matches "Password".
		await expect.element(page.getByLabelText('Password', { exact: true })).toBeVisible();
	});

	it('renders the Sign In button', async () => {
		render(SignIn);
		await expect.element(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
	});

	it('renders a link to the forgot password page', async () => {
		render(SignIn);
		const link = page.getByRole('link', { name: 'Forgot password?' });
		await expect.element(link).toBeVisible();
		expect(link.element().getAttribute('href')).toBe('/auth/forgot-password');
	});

	it('renders a link to the sign-up page', async () => {
		render(SignIn);
		const link = page.getByRole('link', { name: 'Sign up' });
		await expect.element(link).toBeVisible();
		expect(link.element().getAttribute('href')).toBe('/auth/signup');
	});

	it('points sign-up link to a custom redirectTo path', async () => {
		render(SignIn, { props: { redirectTo: '/o/my-org' } });
		const link = page.getByRole('link', { name: 'Sign up' });
		await expect.element(link).toBeVisible();
		expect(link.element().getAttribute('href')).toContain('redirectTo');
	});
});
