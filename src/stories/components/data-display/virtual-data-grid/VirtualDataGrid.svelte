<script lang="ts">
	import {
		createTable,
		getCoreRowModel,
		type ColumnDef,
		type TableState
	} from '@tanstack/table-core';
	import Button from '$components/actions/button/Button.svelte';
	import PageJumper from '$components/data-display/page-jumper/PageJumper.svelte';
	import Dropdown from '$components/data-inputs/dropdown/Dropdown.svelte';

	/** The page sizes the page jumper offers. */
	const JUMP_SIZES = [
		{ value: '10', label: '10' },
		{ value: '100', label: '100' },
		{ value: '1000', label: '1K' },
		{ value: '10000', label: '10K' },
		{ value: '100000', label: '100K' },
		{ value: '1000000', label: '1M' }
	];

	/** One row as the table sees it: its position in the file, and its cells once they have loaded. */
	interface GridRow {
		index: number;
		cells: string[] | null;
	}

	/**
	 * A read-only grid for very large files. TanStack Table builds the columns
	 * and cells, but only for the rows in view: the scroll area is as tall as
	 * every row would be, and the rows near the viewport are drawn at their
	 * place in it. Rows load in pages as they are scrolled to, so a file of
	 * hundreds of thousands of rows never sits in the DOM, or in memory, all at once.
	 *
	 * Browsers cap how tall a scrolling area can be, and some stop at 2^24 pixels (16,777,216),
	 * which is only 372,827 rows at the standard row height; rows past that could never be
	 * reached. So the scroll area is held to `MAX_SCROLL_HEIGHT`, and when the file is taller
	 * than that the scrollbar maps proportionally onto the whole file: the top is the first row,
	 * the bottom is the last row, and each pixel of scrolling moves a little more than a pixel
	 * of rows. A file that fits scrolls one to one, as before.
	 *
	 * Pages of rows already loaded are kept so scrolling back is instant, up to `cachedPages` of
	 * them: past that the ones farthest from the view are dropped, so memory stays flat however
	 * far through the file someone scrolls.
	 *
	 * Create a new grid for a new file (`{#key}`).
	 */
	interface Props {
		/** The column headers, in order. */
		columns: string[];
		/** How many rows the file has, excluding the header. */
		totalRows: number;
		/**
		 * Returns `limit` rows starting at row `offset` (fewer at the end of the
		 * file), each as long as `columns`. A rejection shows a retry button, so
		 * it is not shown to the user.
		 */
		loadRows: (offset: number, limit: number) => Promise<string[][]>;
		/** Rows requested at a time. @default 200 */
		pageSize?: number;
		/**
		 * Pages of rows kept after they are loaded. Beyond this the pages farthest from the view are
		 * dropped, and loaded again if scrolled back to. Never fewer than the pages in view.
		 * @default 100
		 */
		cachedPages?: number;
		/** Height of the scrolling area. @default '28rem' */
		height?: string;
		/**
		 * Fill the height of the container instead of using `height`. The container needs a height
		 * of its own to fill; the grid is never shorter than 16rem. @default false
		 */
		fill?: boolean;
		/**
		 * Float a row of page buttons in the bottom left corner that jump to that part of the file
		 * and follow the scroll. For very long files. @default false
		 */
		pageJumper?: boolean;
		/**
		 * Rows per page button when the grid opens: 10, 100, 1000, 10000, 100000 or 1000000. A small
		 * dropdown beside the buttons changes it. @default 1000
		 */
		jumpSize?: number;
		class?: string;
	}

	const {
		columns,
		totalRows,
		loadRows,
		pageSize = 200,
		cachedPages = 100,
		height = '28rem',
		fill = false,
		pageJumper = false,
		jumpSize = 1000,
		class: className = ''
	}: Props = $props();

	/** Matches a DataTable row: 12px of padding above and below a 20px line, plus its 1px divider. */
	const ROW_HEIGHT = 45;
	const HEADER_HEIGHT = 45;
	/** How far the header card floats in from the top and sides of the frame once the rows scroll. */
	const FLOAT_GAP = 4;
	const INDEX_WIDTH = 72;
	const COLUMN_WIDTH = 176;
	/** Rows drawn above and below the viewport, so a quick scroll does not show a gap. */
	const OVERSCAN = 10;
	/** Narrower than this and the page buttons shrink to fit, grow to finger size, and wrap. */
	const NARROW_WIDTH = 560;
	/**
	 * The tallest the scroll area is made. Safely under the 16,777,216 pixels where some browsers
	 * stop scrolling, and so the scrollbar thumb for a huge file is not shrunk to nothing.
	 */
	const MAX_SCROLL_HEIGHT = 10_000_000;

	let viewport = $state<HTMLDivElement | undefined>();
	let scrollTop = $state(0);
	let scrollLeft = $state(0);
	let viewportWidth = $state(0);
	let viewportOffsetWidth = $state(0);
	let viewportHeight = $state(0);
	/** How tall the floating page buttons are, which changes when they wrap on a narrow grid. */
	let jumperHeight = $state(0);
	/** Loaded rows by page number. */
	let pages = $state<Record<number, string[][]>>({});
	let failed = $state(false);
	/** Pages being fetched, so one is never asked for twice and a jump can wait for one. Not reactive on purpose. */
	const inFlight = new Map<number, Promise<void>>();

	/**
	 * Room kept clear under the last row for the page buttons, which float over the bottom of the
	 * rows. Without it the last row could only be scrolled to under them. Their height plus the
	 * 16px they sit above the bottom.
	 */
	const bottomRoom = $derived(pageJumper ? jumperHeight + 16 : 0);

	/** The frame is too narrow for the full row of page buttons, as on a phone. */
	const narrow = $derived(viewportOffsetWidth > 0 && viewportOffsetWidth < NARROW_WIDTH);

	/** Room the scrollbar takes at the right, which the header must not cover. */
	const scrollbarWidth = $derived(Math.max(0, viewportOffsetWidth - viewportWidth));

	/** The rows have scrolled, so the header is floating. */
	const scrolled = $derived(scrollTop > 0);

	/** How tall all the rows would be at full size. */
	const totalHeight = $derived(totalRows * ROW_HEIGHT);
	/** How tall the scroll area really is: all the rows, up to the cap. */
	const scrollHeight = $derived(Math.min(totalHeight, MAX_SCROLL_HEIGHT));
	/**
	 * Pixels of rows for each pixel of scrolling: 1 when the file fits, more when it is capped. It is
	 * set so that the end of the scroll area lands exactly on the end of the file.
	 */
	const scale = $derived(
		totalHeight > MAX_SCROLL_HEIGHT
			? (totalHeight + HEADER_HEIGHT + bottomRoom - viewportHeight) /
					(scrollHeight + HEADER_HEIGHT + bottomRoom - viewportHeight)
			: 1
	);
	/** How far down the file the view is, in pixels of rows at full size. */
	const virtualTop = $derived(scrollTop * scale);

	const firstRow = $derived(Math.max(0, Math.floor(virtualTop / ROW_HEIGHT) - OVERSCAN));
	const lastRow = $derived(
		Math.min(totalRows, Math.ceil((virtualTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN)
	);
	/**
	 * Where the drawn rows sit inside the scroll area. When the file fits this is just the first
	 * row's place in it. When it is capped the rows follow the viewport instead, shifted so the
	 * right row is at the top. Whole pixels, so the text stays sharp.
	 */
	const blockTop = $derived(Math.round(firstRow * ROW_HEIGHT - virtualTop + scrollTop));

	/** The rows in view, with placeholders for those that have not loaded. */
	const windowRows = $derived.by<GridRow[]>(() => {
		const rows: GridRow[] = [];
		for (let index = firstRow; index < lastRow; index++) {
			const page = pages[Math.floor(index / pageSize)];
			rows.push({ index, cells: page?.[index % pageSize] ?? null });
		}
		return rows;
	});

	const tableColumns = $derived<ColumnDef<GridRow>[]>(
		columns.map((header, i) => ({
			id: String(i),
			header,
			accessorFn: (row) => row.cells?.[i] ?? ''
		}))
	);

	const table = $derived.by(() => {
		const t = createTable<GridRow>({
			data: windowRows,
			columns: tableColumns,
			getCoreRowModel: getCoreRowModel(),
			state: {} as TableState,
			onStateChange: () => {},
			renderFallbackValue: ''
		});
		t.setOptions((prev) => ({ ...prev, state: { ...t.initialState } }));
		return t;
	});

	/** The size picked in the dropdown, which wins over `jumpSize` once there is one. */
	let chosenSize = $state<number | null>(null);
	const step = $derived(chosenSize ?? jumpSize);
	/** Pages are numbered from 0: page 0 is the top, and page n jumps to the row with id n * step. */
	const jumpPageCount = $derived(Math.floor(totalRows / step) + 1);
	/** What a page is called in its tooltip: 0, then each multiple of the step (10, 100 or 1000). */
	const jumpStart = (page: number) => page * step;
	/** The row index (from 0) a page jumps to: the top, then the row whose id is `n * step`. */
	const jumpIndex = (page: number) => Math.max(0, page * step - 1);
	/** The farthest the rows can scroll: the scroll area and the room at its top and bottom, less what shows. */
	const maxScrollTop = $derived(scrollHeight + HEADER_HEIGHT + bottomRoom - viewportHeight);
	/**
	 * Scrolled all the way down. Not at the start of a file that fits on screen, where there is
	 * nothing to scroll. A fraction of a pixel short counts, as browsers scroll to fractions.
	 */
	const atEnd = $derived(maxScrollTop > 0 && scrollTop >= maxScrollTop - 1);
	/**
	 * The page the top row in view belongs to, rounded as browsers scroll to fractions of a pixel.
	 * At the very end it is the last page: its first row may have too few rows after it to ever
	 * reach the top, so it would never be the one at the top, but the end of the file is on it.
	 */
	const currentPage = $derived(
		atEnd
			? jumpPageCount - 1
			: Math.min(jumpPageCount - 1, Math.floor((Math.round(virtualTop / ROW_HEIGHT) + 1) / step))
	);

	/** The row a jump is heading for, while it loads. Not reactive: only the cache trimming reads it. */
	let jumpFocus: number | null = null;

	/**
	 * Drops the loaded pages farthest from where the view is (or is about to be, during a jump)
	 * once there are more than `cachedPages`, keeping at least the pages in view and a couple
	 * around them, so a page on screen is never dropped.
	 */
	function keepNearest(loaded: Record<number, string[][]>): Record<number, string[][]> {
		const numbers = Object.keys(loaded).map(Number);
		const inView = Math.ceil((lastRow - firstRow) / pageSize) + 1;
		const keep = Math.max(cachedPages, inView + 2);
		if (numbers.length <= keep) return loaded;

		const centre = Math.floor((jumpFocus ?? (firstRow + lastRow) / 2) / pageSize);
		numbers.sort((a, b) => Math.abs(a - centre) - Math.abs(b - centre));
		const kept: Record<number, string[][]> = {};
		for (const page of numbers.slice(0, keep)) kept[page] = loaded[page];
		return kept;
	}

	/** The page a jump is loading for. The buttons show it as selected until the scroll lands. */
	let pendingPage = $state<number | null>(null);
	const selectedPage = $derived(pendingPage ?? currentPage);

	/**
	 * Loads the rows a page starts at (and the screen of rows after it), then scrolls there once
	 * they are in, so the jump never lands on rows that are still loading. A newer jump replaces
	 * one that is still loading.
	 */
	async function jumpToPage(page: number) {
		pendingPage = page;
		const index = jumpIndex(page);
		jumpFocus = index;
		const lastIndex = Math.min(totalRows - 1, index + Math.ceil(viewportHeight / ROW_HEIGHT));
		const loads: Promise<void>[] = [];
		for (let p = Math.floor(index / pageSize); p <= Math.floor(lastIndex / pageSize); p++) {
			loads.push(loadPage(p));
		}
		await Promise.all(loads);
		if (pendingPage !== page) return;
		viewport?.scrollTo({ top: (index * ROW_HEIGHT) / scale });
		pendingPage = null;
		jumpFocus = null;
	}

	const contentWidth = $derived(INDEX_WIDTH + columns.length * COLUMN_WIDTH);

	/** Loads one page of rows, or waits for the load already running. */
	function loadPage(page: number): Promise<void> {
		if (pages[page]) return Promise.resolve();
		const running = inFlight.get(page);
		if (running) return running;
		const load = (async () => {
			try {
				const rows = await loadRows(page * pageSize, pageSize);
				pages = keepNearest({ ...pages, [page]: rows });
			} catch {
				failed = true;
			} finally {
				inFlight.delete(page);
			}
		})();
		inFlight.set(page, load);
		return load;
	}

	// Asks for every page the rows in view fall in, once a failure has not stopped it.
	$effect(() => {
		if (failed || lastRow <= firstRow) return;
		for (
			let page = Math.floor(firstRow / pageSize);
			page <= Math.floor((lastRow - 1) / pageSize);
			page++
		) {
			loadPage(page);
		}
	});

	function retry() {
		failed = false;
	}
</script>

<div class="flex flex-col gap-2 {fill ? 'h-full min-h-0' : ''} {className}">
	<!-- The frame: border, rounded corners, and the header laid over the rows as they scroll. -->
	<div
		role="grid"
		aria-label="Spreadsheet"
		aria-rowcount={totalRows + 1}
		aria-colcount={columns.length + 1}
		class="relative overflow-hidden rounded-lg border border-outline bg-surface text-sm {fill
			? 'min-h-0 min-h-64 flex-1'
			: ''}"
	>
		<!-- Scroll anchoring is off: the rows are swapped and moved as the grid scrolls, and Firefox
		     would shift the scroll position to follow them, so a jump drifted off its row. -->
		<div
			bind:this={viewport}
			bind:clientHeight={viewportHeight}
			bind:clientWidth={viewportWidth}
			bind:offsetWidth={viewportOffsetWidth}
			onscroll={(event) => {
				scrollTop = event.currentTarget.scrollTop;
				scrollLeft = event.currentTarget.scrollLeft;
			}}
			data-testid="grid-viewport"
			class="overflow-auto [overflow-anchor:none] {fill ? 'h-full' : ''}"
			style:max-height={fill ? undefined : height}
		>
			<!-- Room for the header, which is laid over this space and not part of the scrolling content. -->
			<div
				class="relative w-full"
				style:min-width="{contentWidth}px"
				style:padding-top="{HEADER_HEIGHT}px"
				style:padding-bottom="{bottomRoom}px"
			>
				<div class="relative" style:height="{scrollHeight}px">
					<div class="absolute inset-x-0" style:top="{blockTop}px">
						{#each table.getRowModel().rows as row (row.original.index)}
							<div
								role="row"
								aria-rowindex={row.original.index + 2}
								class="flex border-b border-outline-subtle hover:bg-surface-container-low"
								style:height="{ROW_HEIGHT}px"
							>
								<div
									role="rowheader"
									class="flex shrink-0 items-center px-4 tabular-nums text-on-surface-subtle"
									style:width="{INDEX_WIDTH}px"
								>
									{row.original.index + 1}
								</div>
								{#each row.getVisibleCells() as cell (cell.id)}
									<div
										role="gridcell"
										class="flex min-w-0 items-center px-4 text-on-surface"
										style:flex="1 0 {COLUMN_WIDTH}px"
									>
										{#if row.original.cells}
											<span class="truncate">{cell.getValue() as string}</span>
										{:else}
											<span
												data-testid="grid-placeholder"
												class="h-3 w-3/4 animate-pulse rounded-sm bg-surface-container-high"
											></span>
										{/if}
									</div>
								{/each}
							</div>
						{/each}
					</div>
				</div>
			</div>
		</div>

		<!-- Floats over the top of the scrolling area, so rows pass beneath it. At the top it is a
		     band flush with the frame; once the rows have scrolled it lifts into a card 5px in
		     from the top and sides. It slides sideways with the columns, stays clear of the
		     scrollbar, and lets the pointer through so the wheel still scrolls the rows. -->
		<div
			role="presentation"
			data-testid="grid-header"
			class="pointer-events-none absolute top-0 left-0 z-10 overflow-x-clip transition-[height,background-color] duration-700 ease-in-out {scrolled
				? 'bg-surface'
				: ''}"
			style:right="{scrollbarWidth}px"
			style:height="{scrolled ? HEADER_HEIGHT + FLOAT_GAP : HEADER_HEIGHT}px"
		>
			<!-- Always bordered and rounded, with the parts that should not show made see-through or
			     square, so every one of them can ease between the two states. -->
			<div
				role="row"
				aria-rowindex={1}
				class="flex cursor-default select-none border bg-surface-container transition-[margin,width,border-color,border-radius,box-shadow] duration-700 ease-in-out {scrolled
					? 'rounded-md border-outline-subtle shadow-md'
					: 'rounded-none border-transparent border-b-outline-subtle shadow-none'}"
				style:height="{HEADER_HEIGHT}px"
				style:margin={scrolled ? `${FLOAT_GAP}px ${FLOAT_GAP}px 0` : '0'}
				style:width={scrolled
					? `calc(max(100%, ${contentWidth}px) - ${FLOAT_GAP * 2}px)`
					: `max(100%, ${contentWidth}px)`}
				style:transform="translateX({-scrollLeft}px)"
			>
				<div
					role="columnheader"
					class="flex shrink-0 items-center px-4 font-medium text-on-surface-subtle"
					style:width="{INDEX_WIDTH}px"
				>
					#
				</div>
				{#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
					{#each headerGroup.headers as header (header.id)}
						<div
							role="columnheader"
							class="flex min-w-0 items-center px-4 font-medium text-on-surface-subtle"
							style:flex="1 0 {COLUMN_WIDTH}px"
						>
							<span class="truncate">{header.column.columnDef.header as string}</span>
						</div>
					{/each}
				{/each}
			</div>
		</div>

		{#if pageJumper}
			<!-- Floats over the rows, clear of the scrollbars, and only the buttons take the pointer. -->
			<!-- Edge to edge less a margin, so on a narrow frame the size dropdown can wrap above the
			     buttons and the whole row sits in the middle. -->
			<div
				bind:clientHeight={jumperHeight}
				class="pointer-events-none absolute bottom-4 left-4 right-4 z-20"
				style:margin-bottom="{scrollbarWidth}px"
				style:margin-right="{scrollbarWidth}px"
			>
				<div
					class="flex flex-wrap items-center gap-2 {narrow ? 'justify-center' : 'justify-start'}"
				>
					<div class="pointer-events-auto rounded-full shadow-sm">
						<Dropdown
							size={narrow ? 'md' : 'sm'}
							aria-label="Page size"
							heading="Page Size"
							items={JUMP_SIZES}
							value={String(step)}
							onValueChange={(value) => (chosenSize = Number(value))}
						/>
					</div>
					<PageJumper
						pageCount={jumpPageCount}
						visible={narrow ? 3 : 5}
						size={narrow ? 'large' : 'default'}
						current={selectedPage}
						onSelect={jumpToPage}
						startOf={jumpStart}
						label="Jump to rows"
					/>
				</div>
			</div>
		{/if}
	</div>

	{#if failed}
		<div role="alert" class="flex items-center gap-3 text-sm text-error">
			Some rows could not be loaded.
			<Button variant="outline" size="sm" onclick={retry}>Try again</Button>
		</div>
	{:else}
		<p class="text-sm text-on-surface-subtle">{totalRows.toLocaleString()} rows</p>
	{/if}
</div>
