import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import UpdateEmail from './UpdateEmail.svelte';

describe('UpdateEmail', () => {
	it('renders the Set your email address heading', async () => {
		render(UpdateEmail);
		await expect.element(page.getByRole('heading', { level: 1 })).toHaveTextContent('Set your email address');
	});

	it('renders the email field', async () => {
		render(UpdateEmail);
		await expect.element(page.getByLabelText('Email')).toBeVisible();
	});

	it('renders the send verification email button', async () => {
		render(UpdateEmail);
		await expect.element(page.getByRole('button', { name: 'Send verification email' })).toBeVisible();
	});
});
