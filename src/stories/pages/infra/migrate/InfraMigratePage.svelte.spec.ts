import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import InfraMigratePage from './InfraMigratePage.svelte';

describe('InfraMigratePage', () => {
	it('renders the page heading', async () => {
		render(InfraMigratePage);
		await expect.element(page.getByRole('heading', { level: 1 })).toHaveTextContent('Database Migration');
	});

	it('renders the Run Migration button', async () => {
		render(InfraMigratePage);
		await expect.element(page.getByRole('button', { name: 'Run Migration' })).toBeVisible();
	});

	it('shows description text before running', async () => {
		render(InfraMigratePage);
		await expect.element(page.getByText(/safe to run on an existing database/i)).toBeVisible();
	});
});
