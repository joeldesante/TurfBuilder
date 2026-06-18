import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import VerifyEmail from './VerifyEmail.svelte';

describe('VerifyEmail', () => {
	it('renders the Verify your email heading', async () => {
		render(VerifyEmail, { props: { email: 'test@example.com' } });
		await expect.element(page.getByRole('heading', { level: 1 })).toHaveTextContent('Verify your email');
	});

	it('renders the user email address', async () => {
		render(VerifyEmail, { props: { email: 'test@example.com' } });
		await expect.element(page.getByText('test@example.com')).toBeVisible();
	});

	it('renders the resend verification email button', async () => {
		render(VerifyEmail, { props: { email: 'test@example.com' } });
		await expect.element(page.getByRole('button', { name: 'Resend verification email' })).toBeVisible();
	});
});
