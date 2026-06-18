import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import ResetPassword from './ResetPassword.svelte';

describe('ResetPassword', () => {
	it('renders the invalid link message when no token is provided', async () => {
		render(ResetPassword, { props: { token: '' } });
		await expect.element(page.getByRole('heading', { level: 1 })).toHaveTextContent('Invalid reset link');
	});

	it('renders the Reset password heading when a token is provided', async () => {
		render(ResetPassword, { props: { token: 'valid-token' } });
		await expect.element(page.getByRole('heading', { level: 1 })).toHaveTextContent('Reset password');
	});

	it('renders the new password and confirm password fields', async () => {
		render(ResetPassword, { props: { token: 'valid-token' } });
		await expect.element(page.getByLabelText('New password')).toBeVisible();
		await expect.element(page.getByLabelText('Confirm new password')).toBeVisible();
	});

	it('renders the reset password button', async () => {
		render(ResetPassword, { props: { token: 'valid-token' } });
		await expect.element(page.getByRole('button', { name: 'Reset password' })).toBeVisible();
	});
});
