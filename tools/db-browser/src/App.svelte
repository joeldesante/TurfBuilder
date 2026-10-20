<script lang="ts">
	import { display, listRows, listTables, type Row, type RowsPage, type TableInfo } from './lib/api';
	import RecordPanel from './lib/RecordPanel.svelte';
	import GraphView from './lib/GraphView.svelte';

	let tables = $state<TableInfo[]>([]);
	let selected = $state<TableInfo | null>(null);
	let data = $state<RowsPage | null>(null);
	let page = $state(0);
	let currentOnly = $state(true);
	let row = $state<Row | null>(null);
	let error = $state('');
	let reload = $state(0);
	let view = $state<'tables' | 'graph'>('tables');
	let graphFocus = $state<string | null>(null);

	const keyOf = (t: TableInfo) => `${t.schema}.${t.name}`;

	// Keep the table picked in the graph visible in the sidebar.
	$effect(() => {
		if (view !== 'graph' || !graphFocus) return;
		document.querySelector(`[data-key="${CSS.escape(graphFocus)}"]`)?.scrollIntoView({
			block: 'nearest'
		});
	});

	const stored = (() => {
		try {
			return localStorage.getItem('theme');
		} catch {
			return null;
		}
	})();
	let theme = $state<'light' | 'dark'>(
		stored === 'light' || stored === 'dark'
			? stored
			: matchMedia('(prefers-color-scheme: dark)').matches
				? 'dark'
				: 'light'
	);

	$effect(() => {
		document.documentElement.dataset.theme = theme;
		try {
			localStorage.setItem('theme', theme);
		} catch {
			// Storage can be blocked; the choice just won't persist.
		}
	});

	const schemas = $derived([...new Set(tables.map((t) => t.schema))]);

	listTables()
		.then((t) => (tables = t))
		.catch((e: Error) => (error = e.message));

	function open(t: TableInfo) {
		selected = t;
		page = 0;
		row = null;
	}

	$effect(() => {
		if (!selected) return;
		reload;
		let stale = false;
		error = '';
		listRows(selected, page, selected.versioned && currentOnly)
			.then((d) => !stale && (data = d))
			.catch((e: Error) => !stale && (error = e.message));
		return () => (stale = true);
	});

	const first = $derived(data && data.total > 0 ? page * data.pageSize + 1 : 0);
	const last = $derived(data ? Math.min(data.total, (page + 1) * data.pageSize) : 0);
</script>

<nav>
	<div class="views">
		<button class:on={view === 'tables'} onclick={() => (view = 'tables')}>tables</button>
		<button class:on={view === 'graph'} onclick={() => (view = 'graph')}>graph</button>
	</div>
	<button class="theme" onclick={() => (theme = theme === 'dark' ? 'light' : 'dark')}>
		{theme === 'dark' ? 'light' : 'dark'}
	</button>
	{#each schemas as schema}
		<h2>{schema}</h2>
		{#each tables.filter((t) => t.schema === schema) as t}
			<button
				data-key={keyOf(t)}
				class:on={view === 'graph' ? graphFocus === keyOf(t) : selected === t}
				onclick={() => (view === 'graph' ? (graphFocus = keyOf(t)) : open(t))}
			>
				{t.name}
				{#if t.temporal}<i title="temporal"></i>{/if}
			</button>
		{/each}
	{/each}
</nav>

{#if view === 'graph'}
	<GraphView bind:focused={graphFocus} />
{:else}
<main>
	{#if error}<p class="error">{error}</p>{/if}
	{#if selected && data}
		<div class="bar">
			<strong>{selected.schema}.{selected.name}</strong>
			<span>{first}-{last} of {data.total}</span>
			<button onclick={() => (page -= 1)} disabled={page === 0}>prev</button>
			<button onclick={() => (page += 1)} disabled={last >= data.total}>next</button>
			{#if selected.versioned}
				<label><input type="checkbox" bind:checked={currentOnly} onchange={() => (page = 0)} /> current only</label>
			{/if}
		</div>
		<div class="scroll">
			<table>
				<thead>
					<tr>{#each data.columns as c}<th>{c}</th>{/each}</tr>
				</thead>
				<tbody>
					{#each data.rows as r}
						<tr class:on={row === r} onclick={() => (row = r)}>
							{#each data.columns as c}
								<td class:null={r[c] === null}>{display(r[c])}</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</main>
{/if}

{#if view === 'tables' && selected && data && row}
	<RecordPanel
		table={selected}
		{row}
		columns={data.columns}
		onclose={() => (row = null)}
		onsaved={() => reload++}
	/>
{/if}

<style>
	:global(:root) {
		color-scheme: light;
		--bg: #fff;
		--fg: #222;
		--muted: #666;
		--faint: #aaa;
		--border: #ddd;
		--hover: #f3f3f3;
		--row: #f0f0f0;
		--sel: #e8e8e8;
		--head: #fafafa;
		--err: #b00020;
		--accent: #1a56db;
		--mark: #fff2a8;
		--mark-border: #d4a700;
		--input: #fff;
	}
	:global(:root[data-theme='dark']) {
		color-scheme: dark;
		--bg: #15171a;
		--fg: #e4e6e9;
		--muted: #9aa0a8;
		--faint: #5d636b;
		--border: #2d3238;
		--hover: #1e2227;
		--row: #22262b;
		--sel: #2a3037;
		--head: #1a1d21;
		--err: #ff7a8a;
		--accent: #6ea8ff;
		--mark: #4d4200;
		--mark-border: #ffd43b;
		--input: #1e2227;
	}
	:global(body) {
		margin: 0;
		display: flex;
		height: 100vh;
		font-family: system-ui, sans-serif;
		font-size: 14px;
		color: var(--fg);
		background: var(--bg);
	}
	:global(#app) {
		display: contents;
	}
	nav {
		width: 220px;
		flex: none;
		overflow: auto;
		border-right: 1px solid var(--border);
		padding: 8px;
		display: flex;
		flex-direction: column;
	}
	h2 {
		font-size: 13px;
		font-weight: 600;
		margin: 12px 8px 4px;
	}
	.views {
		display: flex;
		gap: 4px;
		margin-bottom: 4px;
	}
	nav .views button {
		flex: 1;
		justify-content: center;
	}
	nav button.theme {
		margin: 0 0 4px;
		color: var(--muted);
	}
	nav button {
		all: unset;
		cursor: pointer;
		padding: 3px 8px;
		border-radius: 4px;
		display: flex;
		align-items: center;
		gap: 6px;
	}
	nav button:hover {
		background: var(--hover);
	}
	nav button.on {
		background: var(--sel);
		font-weight: 600;
	}
	i {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--fg);
	}
	main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.bar {
		display: flex;
		gap: 12px;
		align-items: center;
		padding: 8px 12px;
		border-bottom: 1px solid var(--border);
	}
	.bar span {
		color: var(--muted);
	}
	.bar button {
		font: inherit;
		padding: 2px 8px;
		border: 1px solid var(--border);
		background: var(--bg);
		color: var(--fg);
		border-radius: 4px;
		cursor: pointer;
	}
	.bar button:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.scroll {
		flex: 1;
		overflow: auto;
	}
	table {
		border-collapse: collapse;
		font-size: 12px;
	}
	th {
		position: sticky;
		top: 0;
		background: var(--head);
		text-align: left;
		font-weight: 600;
		padding: 4px 10px;
		border-bottom: 1px solid var(--border);
		white-space: nowrap;
	}
	td {
		padding: 3px 10px;
		border-bottom: 1px solid var(--row);
		max-width: 280px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: ui-monospace, monospace;
	}
	td.null {
		color: var(--faint);
	}
	tbody tr {
		cursor: pointer;
	}
	tbody tr:hover,
	tr.on {
		background: var(--hover);
	}
	.error {
		color: var(--err);
		padding: 8px 12px;
		margin: 0;
	}
</style>
