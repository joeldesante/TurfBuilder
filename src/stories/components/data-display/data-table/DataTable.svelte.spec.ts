import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from '@vitest/browser/context';
import DataTable from './DataTable.svelte';
import type { DataTableColumn } from './DataTable.svelte';

type Row = { id: string; name: string; role: string };

const columns: DataTableColumn<Row>[] = [
	{ id: 'name', header: 'Name', accessorKey: 'name' },
	{ id: 'role', header: 'Role', accessorKey: 'role' }
];

const data: Row[] = [
	{ id: '1', name: 'Alice', role: 'Admin' },
	{ id: '2', name: 'Bob', role: 'Member' }
];

describe('DataTable', () => {
	describe('rendering', () => {
		it('renders column headers', async () => {
			render(DataTable<Row>, { data, columns });
			await expect.element(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
			await expect.element(page.getByRole('columnheader', { name: 'Role' })).toBeVisible();
		});

		it('renders data rows', async () => {
			render(DataTable<Row>, { data, columns });
			await expect.element(page.getByRole('cell', { name: 'Alice' })).toBeVisible();
			await expect.element(page.getByRole('cell', { name: 'Bob' })).toBeVisible();
			await expect.element(page.getByRole('cell', { name: 'Admin' })).toBeVisible();
		});

		it('renders empty table when no data', async () => {
			render(DataTable<Row>, { data: [], columns });
			const rows = page.getByRole('row');
			// Only the header row should be present
			await expect.element(rows.first()).toBeVisible();
		});

		it('renders the correct number of rows', async () => {
			render(DataTable<Row>, { data, columns });
			const rows = page.getByRole('row');
			// 1 header + 2 data rows
			expect((await rows.all()).length).toBe(3);
		});
	});

	describe('sorting', () => {
		it('shows sort button when sorting is enabled', async () => {
			const sortableColumns: DataTableColumn<Row>[] = [
				{ id: 'name', header: 'Name', accessorKey: 'name', enableSorting: true }
			];
			render(DataTable<Row>, { data, columns: sortableColumns, sorting: true });
			await expect.element(page.getByRole('button', { name: 'Name' })).toBeVisible();
		});

		it('does not show sort button when sorting is disabled', async () => {
			render(DataTable<Row>, { data, columns });
			await expect.element(page.getByRole('button', { name: 'Name' })).not.toBeInTheDocument();
		});
	});

	describe('pagination', () => {
		it('shows pagination controls when enabled', async () => {
			render(DataTable<Row>, { data, columns, pagination: true });
			await expect.element(page.getByRole('button', { name: 'Previous' })).toBeVisible();
			await expect.element(page.getByRole('button', { name: 'Next' })).toBeVisible();
		});

		it('hides pagination controls when disabled', async () => {
			render(DataTable<Row>, { data, columns });
			await expect
				.element(page.getByRole('button', { name: 'Previous' }))
				.not.toBeInTheDocument();
		});

		it('shows page count', async () => {
			render(DataTable<Row>, { data, columns, pagination: true });
			await expect.element(page.getByText('Page 1 of 1')).toBeVisible();
		});
	});

	describe('selection', () => {
		it('shows select-all checkbox when selectable', async () => {
			render(DataTable<Row>, { data, columns, selectable: true });
			await expect
				.element(page.getByRole('checkbox', { name: 'Select all rows' }))
				.toBeVisible();
		});

		it('shows per-row checkboxes when selectable', async () => {
			render(DataTable<Row>, { data, columns, selectable: true });
			const rowCheckboxes = page.getByRole('checkbox', { name: 'Select row' });
			await expect.element(rowCheckboxes.first()).toBeVisible();
		});

		it('does not show checkboxes when not selectable', async () => {
			render(DataTable<Row>, { data, columns });
			await expect
				.element(page.getByRole('checkbox', { name: 'Select all rows' }))
				.not.toBeInTheDocument();
		});
	});
});
