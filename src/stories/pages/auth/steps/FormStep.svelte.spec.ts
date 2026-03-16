import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import FormStep from './FormStep.svelte';

describe('FormStep', () => {
	it('renders the Sign Up heading', async () => {
		render(FormStep, { onComplete: vi.fn() });
		await expect.element(page.getByRole('heading', { level: 1 })).toHaveTextContent('Sign Up');
	});

	it('renders Username, Password, and Confirm Password fields', async () => {
		render(FormStep, { onComplete: vi.fn() });
		await expect.element(page.getByLabelText('Username')).toBeVisible();
		await expect.element(page.getByLabelText('Password')).toBeVisible();
		await expect.element(page.getByLabelText('Confirm Password')).toBeVisible();
	});

	it('renders the Sign Up submit button', async () => {
		render(FormStep, { onComplete: vi.fn() });
		await expect.element(page.getByRole('button', { name: 'Sign Up' })).toBeVisible();
	});

	it('renders the sign-in link', async () => {
		render(FormStep, { onComplete: vi.fn() });
		await expect.element(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
	});

	it('does not show an error message on initial render', async () => {
		render(FormStep, { onComplete: vi.fn() });
		await expect.element(page.getByText('Passwords do not match.')).not.toBeInTheDocument();
	});
});
