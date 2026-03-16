import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import AdaptiveDataGrid from './AdaptiveDataGrid.svelte';
import type { Column } from './AdaptiveDataGrid.svelte';

const columns: Column[] = [
	{ key: 'name', label: 'Name' },
	{ key: 'email', label: 'Email' }
];

const data = [
	{ name: 'Alice', email: 'alice@example.com' },
	{ name: 'Bob', email: 'bob@example.com' }
];

describe('AdaptiveDataGrid', () => {
	describe('rendering', () => {
		it('renders a grid element with accessible role', async () => {
			render(AdaptiveDataGrid, { columns, data });
			await expect.element(page.getByRole('grid', { name: 'Data grid' })).toBeVisible();
		});

		it('renders column headers', async () => {
			render(AdaptiveDataGrid, { columns, data });
			await expect.element(page.getByRole('button', { name: 'Name' })).toBeVisible();
			await expect.element(page.getByRole('button', { name: 'Email' })).toBeVisible();
		});

		it('renders with empty data', async () => {
			render(AdaptiveDataGrid, { columns, data: [] });
			await expect.element(page.getByRole('grid', { name: 'Data grid' })).toBeVisible();
		});

		it('renders with no columns', async () => {
			render(AdaptiveDataGrid, { columns: [], data: [] });
			await expect.element(page.getByRole('grid', { name: 'Data grid' })).toBeVisible();
		});
	});

	describe('add column button', () => {
		it('shows a + button for the first inactive column', async () => {
			render(AdaptiveDataGrid, { columns, data });
			const addButton = page.getByRole('button', { name: '+' });
			await expect.element(addButton).toBeVisible();
		});

		it('calls oncolumnadd when the + button is clicked', async () => {
			const oncolumnadd = vi.fn();
			render(AdaptiveDataGrid, { columns, data, oncolumnadd });
			await page.getByRole('button', { name: '+' }).click();
			expect(oncolumnadd).toHaveBeenCalled();
		});

		it('does not call oncolumnadd in readonly mode', async () => {
			const oncolumnadd = vi.fn();
			render(AdaptiveDataGrid, { columns, data, oncolumnadd, readonly: true });
			await page.getByRole('button', { name: '+' }).click();
			expect(oncolumnadd).not.toHaveBeenCalled();
		});
	});
});
