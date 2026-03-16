import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import Signup from './Signup.svelte';

describe('Signup', () => {
	it('renders the Sign Up heading', async () => {
		render(Signup, { data: {} });
		await expect.element(page.getByRole('heading', { level: 1 })).toHaveTextContent('Sign Up');
	});

	it('renders the username, password, and confirm password fields', async () => {
		render(Signup, { data: {} });
		await expect.element(page.getByLabelText('Username')).toBeVisible();
		await expect.element(page.getByLabelText('Password')).toBeVisible();
		await expect.element(page.getByLabelText('Confirm Password')).toBeVisible();
	});

	it('renders the Sign Up button', async () => {
		render(Signup, { data: {} });
		await expect.element(page.getByRole('button', { name: 'Sign Up' })).toBeVisible();
	});

	it('renders a link to the sign-in page', async () => {
		render(Signup, { data: {} });
		const link = page.getByRole('link', { name: 'Sign in' });
		await expect.element(link).toBeVisible();
		expect(link.element().getAttribute('href')).toBe('/auth/signin');
	});

	it('points sign-in link to a custom redirectTo path', async () => {
		render(Signup, { data: {}, redirectTo: '/o/my-org' });
		const link = page.getByRole('link', { name: 'Sign in' });
		await expect.element(link).toBeVisible();
		expect(link.element().getAttribute('href')).toContain('redirectTo');
	});
});
