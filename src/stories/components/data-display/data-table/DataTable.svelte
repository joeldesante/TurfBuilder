<script module lang="ts">
	import type { Snippet } from 'svelte';

	export interface DataTableColumn<T> {
		id: string;
		accessorKey?: string;
		header: string;
		cell?: Snippet<[{ value: unknown; row: T }]>;
		enableSorting?: boolean;
		size?: number;
	}
</script>

<script lang="ts" generics="TData">
	import {
		createTable,
		getCoreRowModel,
		getSortedRowModel,
		getPaginationRowModel,
		type ColumnDef,
		type SortingState,
		type PaginationState,
		type RowSelectionState,
		type TableState
	} from '@tanstack/table-core';
	import ArrowsDownUpIcon from 'phosphor-svelte/lib/ArrowsDownUpIcon';
	import ArrowUpIcon from 'phosphor-svelte/lib/ArrowUpIcon';
	import ArrowDownIcon from 'phosphor-svelte/lib/ArrowDownIcon';
	import Button from '$components/actions/button/Button.svelte';
	import Checkbox from '$components/data-inputs/checkbox/Checkbox.svelte';

	interface Props {
		data: TData[];
		columns: DataTableColumn<TData>[];
		sorting?: boolean;
		pagination?: boolean;
		selectable?: boolean;
		pageSize?: number;
		selected?: RowSelectionState;
		class?: string;
	}

	let {
		data,
		columns,
		sorting: enableSorting = false,
		pagination: enablePagination = false,
		selectable = false,
		pageSize = 20,
		selected = $bindable({}),
		class: className = ''
	}: Props = $props();

	let sortingState = $state<SortingState>([]);
	let rowSelection = $state<RowSelectionState>({});
	let pageIndex = $state(0);

	$effect(() => {
		selected = rowSelection;
	});

	const tanstackColumns = $derived<ColumnDef<TData>[]>([
		...(selectable
			? [
					{
						id: '__select__',
						header: '',
						cell: '',
						size: 40,
						enableSorting: false
					} as unknown as ColumnDef<TData>
				]
			: []),
		...columns.map(
			(col) =>
				({
					id: col.id,
					...(col.accessorKey
						? { accessorKey: col.accessorKey }
						: { accessorFn: (row: TData) => (row as Record<string, unknown>)[col.id] }),
					header: col.header,
					enableSorting: col.enableSorting ?? enableSorting,
					size: col.size
				}) as ColumnDef<TData>
		)
	]);

	const tableInstance = $derived.by(() => {
		const _data = data;
		const _cols = tanstackColumns;
		const _sorting = sortingState;
		const _selection = rowSelection;
		const _pageIndex = pageIndex;

		const t = createTable<TData>({
			data: _data,
			columns: _cols,
			getCoreRowModel: getCoreRowModel(),
			...(enableSorting ? { getSortedRowModel: getSortedRowModel() } : {}),
			...(enablePagination ? { getPaginationRowModel: getPaginationRowModel() } : {}),
			enableRowSelection: selectable,
			// state is set immediately after via setOptions — this placeholder
			// satisfies the TypeScript type before the real state is applied.
			state: {} as TableState,
			onStateChange: () => {},
			onSortingChange: (updater) => {
				sortingState =
					typeof updater === 'function' ? updater(sortingState) : updater;
			},
			onRowSelectionChange: (updater) => {
				rowSelection =
					typeof updater === 'function' ? updater(rowSelection) : updater;
			},
			onPaginationChange: (updater) => {
				const next =
					typeof updater === 'function'
						? updater({ pageIndex, pageSize })
						: updater;
				pageIndex = next.pageIndex;
			},
			renderFallbackValue: null
		});

		// createTable does NOT set table.options.state automatically — that is the
		// adapter's responsibility. We must call setOptions to merge the computed
		// initialState (which contains all feature defaults) with our managed state,
		// otherwise table.getState() returns undefined and crashes.
		t.setOptions((prev) => ({
			...prev,
			state: {
				...t.initialState,
				sorting: _sorting,
				rowSelection: _selection,
				pagination: { pageIndex: _pageIndex, pageSize } as PaginationState
			}
		}));

		return t;
	});
</script>

<div class="overflow-auto rounded-lg border border-outline {className}">
	<table class="w-full text-sm">
		<thead>
			{#each tableInstance.getHeaderGroups() as headerGroup}
				<tr class="border-b border-outline bg-surface-container">
					{#each headerGroup.headers as header}
						<th
							class="px-4 py-3 text-left font-medium text-on-surface-variant whitespace-nowrap"
							style={header.column.getSize() !== 150
								? `width: ${header.column.getSize()}px`
								: undefined}
						>
							{#if header.id === '__select__'}
								<Checkbox
									checked={tableInstance.getIsAllRowsSelected()}
									indeterminate={tableInstance.getIsSomeRowsSelected()}
									onCheckedChange={() => tableInstance.toggleAllRowsSelected()}
									aria-label="Select all rows"
								/>
							{:else if header.column.getCanSort()}
								<button
									class="inline-flex items-center gap-1 cursor-pointer hover:text-on-surface transition-colors"
									onclick={header.column.getToggleSortingHandler()}
								>
									{header.column.columnDef.header as string}
									{#if header.column.getIsSorted() === 'asc'}
										<ArrowUpIcon class="size-3.5" />
									{:else if header.column.getIsSorted() === 'desc'}
										<ArrowDownIcon class="size-3.5" />
									{:else}
										<ArrowsDownUpIcon class="size-3.5 opacity-40" />
									{/if}
								</button>
							{:else}
								{header.column.columnDef.header as string}
							{/if}
						</th>
					{/each}
				</tr>
			{/each}
		</thead>
		<tbody>
			{#each tableInstance.getRowModel().rows as row}
				<tr class="border-b border-outline last:border-0 hover:bg-surface-container-low">
					{#each row.getVisibleCells() as cell}
						<td class="px-4 py-3 text-on-surface">
							{#if cell.column.id === '__select__'}
								<Checkbox
									checked={row.getIsSelected()}
									disabled={!row.getCanSelect()}
									onCheckedChange={() => row.toggleSelected()}
									aria-label="Select row"
								/>
							{:else}
								{@const col = columns.find((c) => c.id === cell.column.id)}
								{#if col?.cell}
									{@render col.cell({
										value: cell.getValue() as unknown,
										row: row.original
									})}
								{:else}
									{String(cell.getValue() ?? '')}
								{/if}
							{/if}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>

	{#if enablePagination}
		{@const pageCount = tableInstance.getPageCount()}
		{@const currentPage = tableInstance.getState().pagination.pageIndex}
		<div
			class="flex items-center justify-between px-4 py-3 border-t border-outline bg-surface-container"
		>
			<p class="text-sm text-on-surface-variant">
				Page {currentPage + 1} of {pageCount || 1}
			</p>
			<div class="flex gap-2">
				<Button
					variant="outline"
					size="sm"
					onclick={() => tableInstance.previousPage()}
					disabled={!tableInstance.getCanPreviousPage()}
				>
					Previous
				</Button>
				<Button
					variant="outline"
					size="sm"
					onclick={() => tableInstance.nextPage()}
					disabled={!tableInstance.getCanNextPage()}
				>
					Next
				</Button>
			</div>
		</div>
	{/if}
</div>
