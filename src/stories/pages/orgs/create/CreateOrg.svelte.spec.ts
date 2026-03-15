import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import CreateOrg from './CreateOrg.svelte';

describe('CreateOrg', () => {
	it('renders the heading', async () => {
		render(CreateOrg, { onCreate: vi.fn() });
		await expect
			.element(page.getByRole('heading', { level: 1 }))
			.toHaveTextContent('Create Organization');
	});

	it('renders name and slug inputs', async () => {
		render(CreateOrg, { onCreate: vi.fn() });
		await expect.element(page.getByLabelText('Name')).toBeVisible();
		await expect.element(page.getByLabelText('Slug')).toBeVisible();
	});

	it('auto-derives slug from name input', async () => {
		render(CreateOrg, { onCreate: vi.fn() });
		await page.getByLabelText('Name').fill('North West Philly Alliance');
		const slugInput = page.getByLabelText('Slug');
		await expect.element(slugInput).toHaveValue('north-west-philly-alliance');
	});

	it('calls onCreate with name and slug on submit', async () => {
		const onCreate = vi.fn().mockResolvedValue(undefined);
		render(CreateOrg, { onCreate });
		await page.getByLabelText('Name').fill('Test Org');
		await page.getByRole('button', { name: 'Create Organization' }).click();
		expect(onCreate).toHaveBeenCalledWith('Test Org', 'test-org');
	});

	it('shows error message when onCreate rejects', async () => {
		const onCreate = vi.fn().mockRejectedValue(new Error('That slug is already taken.'));
		render(CreateOrg, { onCreate });
		await page.getByLabelText('Name').fill('Test Org');
		await page.getByRole('button', { name: 'Create Organization' }).click();
		await expect.element(page.getByRole('alert')).toHaveTextContent('That slug is already taken.');
	});

	it('does not show error message initially', async () => {
		render(CreateOrg, { onCreate: vi.fn() });
		const alert = page.getByRole('alert');
		await expect.element(alert).not.toBeVisible();
	});
});
