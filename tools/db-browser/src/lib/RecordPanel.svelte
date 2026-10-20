<script lang="ts">
	import { display, listVersions, newVersion, type Row, type TableInfo } from './api';
	import VersionGraph from './VersionGraph.svelte';

	let {
		table,
		row,
		columns,
		onclose,
		onsaved
	}: {
		table: TableInfo;
		row: Row;
		columns: string[];
		onclose: () => void;
		onsaved: () => void;
	} = $props();

	// Set by the tool or copied from the version being edited.
	const FIXED = ['id', 'entity_id', 'org_id', 'valid_from', 'valid_to', 'created_at'];

	let versions = $state<Row[]>([row]);
	let index = $state(0);
	let error = $state('');
	let draft = $state<Record<string, string> | null>(null);
	let saving = $state(false);

	function load(clicked: Row, select: 'clicked' | 'newest') {
		return listVersions(table, String(clicked.entity_id)).then((result) => {
			versions = result.versions;
			index =
				select === 'newest'
					? 0
					: Math.max(0, result.versions.findIndex((v) => v.id === clicked.id));
		});
	}

	$effect(() => {
		const clicked = row;
		error = '';
		draft = null;
		versions = [clicked];
		index = 0;
		if (!table.versioned) return;

		let stale = false;
		load(clicked, 'clicked').catch((e: Error) => !stale && (error = e.message));
		return () => (stale = true);
	});

	const text = (v: unknown) => (v === null || v === undefined ? '' : display(v));

	function startEdit() {
		draft = Object.fromEntries(
			columns.filter((c) => !FIXED.includes(c)).map((c) => [c, text(shown[c])])
		);
	}

	async function save() {
		if (!draft) return;
		const changes: Record<string, string | null> = {};
		for (const [col, value] of Object.entries(draft)) {
			if (value !== text(shown[col])) changes[col] = value === '' ? null : value;
		}

		saving = true;
		error = '';
		try {
			await newVersion(table, String(shown.id), changes);
			draft = null;
			await load(shown, 'newest');
			onsaved();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			saving = false;
		}
	}

	const shown = $derived(versions[index]);
	const older = $derived(versions[index + 1]);
	const changed = (col: string) => older !== undefined && display(shown[col]) !== display(older[col]);

	function step(delta: number) {
		index = Math.min(versions.length - 1, Math.max(0, index + delta));
	}

	function onkey(e: KeyboardEvent) {
		if (draft || versions.length < 2 || (e.target as HTMLElement).closest('input, textarea')) return;
		if (e.key === 'ArrowDown' || e.key === 'ArrowRight') step(1);
		else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') step(-1);
		else return;
		e.preventDefault();
	}
</script>

<svelte:window onkeydown={onkey} />

<aside>
	<header>
		<span>{table.schema}.{table.name}</span>
		<button onclick={onclose} aria-label="Close">x</button>
	</header>

	{#if error}<p class="error">{error}</p>{/if}

	{#if table.versioned}
		<div class="nav">
			{#if draft}
				<button onclick={save} disabled={saving}>save version</button>
				<button onclick={() => (draft = null)} disabled={saving}>cancel</button>
			{:else}
				<button onclick={startEdit}>new version</button>
			{/if}
		</div>
	{/if}

	{#if versions.length > 1}
		<div class="nav">
			<button onclick={() => step(-1)} disabled={index === 0}>newer</button>
			<span>{versions.length - index} / {versions.length}</span>
			<button onclick={() => step(1)} disabled={index === versions.length - 1}>older</button>
			<button onclick={() => (index = 0)} disabled={index === 0}>current</button>
			<button onclick={() => (index = versions.length - 1)} disabled={index === versions.length - 1}>
				first
			</button>
		</div>
		<div class="graphbox">
			<VersionGraph {versions} selected={index} onselect={(i) => (index = i)} />
		</div>
	{/if}

	<dl>
		{#each columns as col}
			<dt class:changed={changed(col)}>{col}</dt>
			{#if draft && col in draft}
				<dd><textarea rows="1" bind:value={draft[col]} placeholder="null"></textarea></dd>
			{:else}
				<dd class:changed={changed(col)} class:null={shown[col] === null}>
					{display(shown[col])}
				</dd>
			{/if}
		{/each}
	</dl>
</aside>

<style>
	aside {
		width: 420px;
		flex: none;
		border-left: 1px solid var(--border);
		overflow: auto;
		padding: 12px 16px;
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-weight: 600;
		margin-bottom: 12px;
	}
	.nav {
		display: flex;
		gap: 6px;
		align-items: center;
		margin-bottom: 12px;
		font-size: 13px;
	}
	.nav span {
		color: var(--muted);
		min-width: 48px;
		text-align: center;
	}
	.graphbox {
		max-height: 260px;
		overflow: auto;
		margin-bottom: 16px;
		padding-bottom: 4px;
		border-bottom: 1px solid var(--border);
	}
	button {
		font: inherit;
		font-size: 13px;
		padding: 2px 8px;
		border: 1px solid var(--border);
		background: var(--bg);
		color: var(--fg);
		border-radius: 4px;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.4;
		cursor: default;
	}
	textarea {
		box-sizing: border-box;
		width: 100%;
		font: inherit;
		field-sizing: content;
		min-height: 1.6em;
		padding: 2px 6px;
		color: var(--fg);
		background: var(--input);
		border: 1px solid var(--border);
		border-radius: 4px;
		resize: vertical;
	}
	dl {
		margin: 0;
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 4px 12px;
		font-size: 13px;
	}
	dt {
		color: var(--muted);
	}
	dd {
		margin: 0;
		word-break: break-word;
		font-family: ui-monospace, monospace;
		font-size: 12px;
	}
	dd.null {
		color: var(--faint);
	}
	.changed {
		color: var(--fg);
		font-weight: 600;
	}
	.error {
		color: var(--err);
		font-size: 13px;
	}
</style>
