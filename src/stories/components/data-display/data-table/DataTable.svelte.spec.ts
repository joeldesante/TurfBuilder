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
			await expect.element(page.getByRole('button', { name: 'Previous' })).not.toBeInTheDocument();
		});

		it('shows page count', async () => {
			render(DataTable<Row>, { data, columns, pagination: true });
			await expect.element(page.getByText('Page 1 of 1')).toBeVisible();
		});
	});

	describe('selection', () => {
		it('shows select-all checkbox when selectable', async () => {
			render(DataTable<Row>, { data, columns, selectable: true });
			await expect.element(page.getByRole('checkbox', { name: 'Select all rows' })).toBeVisible();
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

	describe('header text', () => {
		it('shows the normal arrow over a header, not the text cursor', async () => {
			render(DataTable<Row>, { data, columns });
			await expect
				.element(page.getByRole('columnheader', { name: 'Name' }))
				.toHaveClass(/cursor-default/);
			await expect
				.element(page.getByRole('columnheader', { name: 'Name' }))
				.toHaveClass(/select-none/);
		});

		it('still shows the pointer over a header that sorts', async () => {
			render(DataTable<Row>, { data, columns, sorting: true });
			await expect
				.element(page.getByRole('button', { name: /Name/ }))
				.toHaveClass(/cursor-pointer/);
		});
	});

	describe('layout options', () => {
		type Wide = { id: string; name: string; members: number; note: string };
		const wide: Wide[] = [{ id: 'a', name: 'Acme', members: 12, note: 'Hello' }];
		const wideColumns: DataTableColumn<Wide>[] = [
			{ id: 'name', accessorKey: 'name', header: 'Name' },
			{ id: 'members', accessorKey: 'members', header: 'Members', align: 'right', tabular: true },
			{ id: 'note', accessorKey: 'note', header: 'Note', hideBelow: 'lg', nowrap: true },
			{ id: 'actions', header: 'Actions', srOnlyHeader: true }
		];

		it('right-aligns a column and gives its digits equal width', async () => {
			render(DataTable<Wide>, { data: wide, columns: wideColumns });
			await expect
				.element(page.getByRole('columnheader', { name: 'Members' }))
				.toHaveClass(/text-right/);
			await expect.element(page.getByRole('cell', { name: '12' })).toHaveClass(/text-right/);
			await expect.element(page.getByRole('cell', { name: '12' })).toHaveClass(/tabular-nums/);
		});

		it('hides a column below its breakpoint, header and cells alike', async () => {
			render(DataTable<Wide>, { data: wide, columns: wideColumns });
			await expect.element(page.getByRole('columnheader', { name: 'Note' })).toHaveClass(/hidden/);
			await expect
				.element(page.getByRole('columnheader', { name: 'Note' }))
				.toHaveClass(/lg:table-cell/);
			await expect.element(page.getByText('Hello')).toHaveClass(/lg:table-cell/);
		});

		it('keeps an action column header for screen readers only', async () => {
			render(DataTable<Wide>, { data: wide, columns: wideColumns });
			await expect.element(page.getByText('Actions')).toHaveClass(/sr-only/);
		});

		it('names the table for screen readers', async () => {
			render(DataTable<Wide>, { data: wide, columns: wideColumns, label: 'Organizations' });
			await expect.element(page.getByRole('table', { name: 'Organizations' })).toBeVisible();
		});

		it('draws a border by default and leaves it off when asked', async () => {
			const first = render(DataTable<Wide>, { data: wide, columns: wideColumns });
			expect(first.container.querySelector('.border-outline')).not.toBeNull();
			first.unmount();

			const second = render(DataTable<Wide>, { data: wide, columns: wideColumns, bordered: false });
			expect(second.container.querySelector('div.border-outline')).toBeNull();
		});

		it('adds a class to rows from rowClass', async () => {
			render(DataTable<Wide>, {
				data: wide,
				columns: wideColumns,
				rowClass: (row: Wide) => (row.members > 10 ? 'bg-warning/10' : '')
			});
			await expect.element(page.getByRole('row').nth(1)).toHaveClass(/bg-warning/);
		});
	});

	describe('empty state', () => {
		it('says there is nothing to show by default', async () => {
			render(DataTable<Row>, { data: [], columns });
			await expect.element(page.getByText('Nothing to show.')).toBeVisible();
		});

		it('shows the wording it is given, across every column', async () => {
			const { container } = render(DataTable<Row>, { data: [], columns, empty: 'No members yet.' });
			await expect.element(page.getByText('No members yet.')).toBeVisible();
			expect(container.querySelector('td[colspan="2"]')).not.toBeNull();
		});

		it('shows no empty message when there are rows', async () => {
			render(DataTable<Row>, { data, columns });
			await expect.element(page.getByText('Nothing to show.')).not.toBeInTheDocument();
		});
	});

	describe('row ids and values', () => {
		it('keeps working when rows are given ids', async () => {
			render(DataTable<Row>, { data, columns, getRowId: (row: Row) => row.id });
			await expect.element(page.getByRole('cell', { name: 'Alice' })).toBeVisible();
			await expect.element(page.getByRole('cell', { name: 'Bob' })).toBeVisible();
		});

		it('reads a cell from accessorFn when one is given', async () => {
			const fn: DataTableColumn<Row>[] = [
				{ id: 'both', header: 'Both', accessorFn: (row: Row) => `${row.name} (${row.role})` }
			];
			render(DataTable<Row>, { data, columns: fn });
			await expect.element(page.getByRole('cell', { name: 'Alice (Admin)' })).toBeVisible();
		});
	});
});
