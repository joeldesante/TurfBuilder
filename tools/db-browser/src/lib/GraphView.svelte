<script lang="ts">
	import { getSchema, type GraphFk, type GraphTable } from './api';
	import { HEADER, layout, NODE_W, nodeHeight, ROW, type Point } from './layout';

	let tables = $state<GraphTable[]>([]);
	let fks = $state<GraphFk[]>([]);
	let pos = $state<Record<string, Point>>({});
	let selected = $state(new Set<number>());
	let view = $state({ x: 0, y: 0, k: 1 });
	let error = $state('');
	// Shared with the sidebar: clicking a table here selects it there, and the other way round.
	let { focused = $bindable<string | null>(null) }: { focused?: string | null } = $props();

	let isolated = $state(false);
	let isolatedFor: string | null = null;
	let saved: Record<string, Point> = {};
	let svg = $state<SVGSVGElement>();

	const byKey = $derived(Object.fromEntries(tables.map((t) => [t.key, t])));

	/** Foreign keys to or from the focused table. */
	const focusFks = $derived(
		focused ? fks.filter((f) => f.from === focused || f.to === focused) : []
	);
	const neighborhood = $derived(
		new Set(focused ? [focused, ...focusFks.flatMap((f) => [f.from, f.to])] : [])
	);

	const anySelected = $derived(selected.size > 0 || focused !== null);

	/** Edges drawn in the accent color: selected columns plus the focused table's keys. */
	const litFks = $derived(
		new Set([...selected, ...focusFks.map((f) => f.id)])
	);

	/** Tables kept at full strength: ends of lit foreign keys, and the focused table. */
	const touched = $derived(
		new Set([
			...fks.filter((f) => litFks.has(f.id)).flatMap((f) => [f.from, f.to]),
			...neighborhood
		])
	);

	const visibleTables = $derived(
		isolated ? tables.filter((t) => neighborhood.has(t.key)) : tables
	);

	/** Column-to-foreign-key lookup, so a click on a column finds its constraints. */
	const fksByColumn = $derived.by(() => {
		const map = new Map<string, number[]>();
		for (const f of fks) {
			for (const col of f.cols) {
				const key = `${f.from}.${col}`;
				map.set(key, [...(map.get(key) ?? []), f.id]);
			}
		}
		return map;
	});

	const highlightedColumns = $derived.by(() => {
		const set = new Set<string>();
		for (const f of fks) {
			if (!selected.has(f.id)) continue;
			f.cols.forEach((c) => set.add(`${f.from}.${c}`));
			f.refCols.forEach((c) => set.add(`${f.to}.${c}`));
		}
		return set;
	});

	function rowY(key: string, column: string): number {
		const index = byKey[key].columns.findIndex((c) => c.name === column);
		return pos[key].y + HEADER + Math.max(0, index) * ROW + ROW / 2;
	}

	const edges = $derived(
		tables.length === 0
			? []
			: fks
					.filter((f) => !isolated || (neighborhood.has(f.from) && neighborhood.has(f.to)))
					.map((f) => {
					const a = pos[f.from];
					const b = pos[f.to];
					const y1 = rowY(f.from, f.cols[0]);
					const y2 = rowY(f.to, f.refCols[0]);

					if (f.from === f.to) {
						const x = a.x + NODE_W;
						return {
							id: f.id,
							inferred: f.inferred,
							d: `M${x},${y1} C${x + 70},${y1} ${x + 70},${y2} ${x},${y2}`
						};
					}

					const leftOfTarget = a.x + NODE_W / 2 < b.x + NODE_W / 2;
					const x1 = leftOfTarget ? a.x + NODE_W : a.x;
					const x2 = leftOfTarget ? b.x : b.x + NODE_W;
					const bend = leftOfTarget ? 60 : -60;
					return {
						id: f.id,
						inferred: f.inferred,
						d: `M${x1},${y1} C${x1 + bend},${y1} ${x2 - bend},${y2} ${x2},${y2}`
					};
				})
	);

	function fit() {
		if (!svg || visibleTables.length === 0) return;
		const xs = visibleTables.flatMap((t) => [pos[t.key].x, pos[t.key].x + NODE_W]);
		const ys = visibleTables.flatMap((t) => [pos[t.key].y, pos[t.key].y + nodeHeight(t)]);
		const minX = Math.min(...xs);
		const minY = Math.min(...ys);
		const w = Math.max(...xs) - minX;
		const h = Math.max(...ys) - minY;
		const box = svg.getBoundingClientRect();
		const k = Math.min(box.width / (w + 80), box.height / (h + 80), 1.5);
		view = { k, x: (box.width - w * k) / 2 - minX * k, y: (box.height - h * k) / 2 - minY * k };
	}

	getSchema()
		.then((s) => {
			tables = s.tables;
			fks = s.fks;
			pos = layout(s.tables, s.fks);
			requestAnimationFrame(fit);
		})
		.catch((e: Error) => (error = e.message));

	function isolate() {
		if (!focused) return;
		const sub = tables.filter((t) => neighborhood.has(t.key));
		const subFks = fks.filter((f) => neighborhood.has(f.from) && neighborhood.has(f.to));
		saved = { ...pos };
		isolatedFor = focused;
		pos = { ...pos, ...layout(sub, subFks) };
		isolated = true;
		requestAnimationFrame(fit);
	}

	function leave() {
		if (isolated) {
			pos = { ...pos, ...saved };
			isolated = false;
			requestAnimationFrame(fit);
		}
	}

	// Focusing a different table (from the sidebar) ends isolation of the old one.
	$effect(() => {
		if (isolated && focused !== isolatedFor) leave();
	});

	function focus(key: string | null) {
		if (isolated) leave();
		focused = key === focused ? null : key;
	}

	function toggle(table: string, column: string) {
		const ids = fksByColumn.get(`${table}.${column}`);
		if (!ids) return;
		const next = new Set(selected);
		const allOn = ids.every((id) => next.has(id));
		ids.forEach((id) => (allOn ? next.delete(id) : next.add(id)));
		selected = next;
	}

	// Wheel zoom has to call preventDefault, which Svelte's onwheel (passive) cannot.
	$effect(() => {
		if (!svg) return;
		const el = svg;
		const onwheel = (e: WheelEvent) => {
			e.preventDefault();
			const box = el.getBoundingClientRect();
			const mx = e.clientX - box.left;
			const my = e.clientY - box.top;
			const k = Math.min(3, Math.max(0.1, view.k * Math.exp(-e.deltaY * 0.0015)));
			view = {
				k,
				x: mx - ((mx - view.x) / view.k) * k,
				y: my - ((my - view.y) / view.k) * k
			};
		};
		el.addEventListener('wheel', onwheel, { passive: false });
		return () => el.removeEventListener('wheel', onwheel);
	});

	let drag: { key: string | null; x: number; y: number; travelled: number } | null = null;

	function down(e: PointerEvent, key: string | null) {
		e.stopPropagation();
		svg?.setPointerCapture(e.pointerId);
		drag = { key, x: e.clientX, y: e.clientY, travelled: 0 };
	}

	/** A press that barely moved is a click: on a table it focuses it, on the background it clears. */
	function up() {
		if (drag && drag.travelled < 4) {
			if (drag.key) focus(drag.key);
			else if (focused) focus(focused);
		}
		drag = null;
	}

	function move(e: PointerEvent) {
		if (!drag) return;
		const dx = e.clientX - drag.x;
		const dy = e.clientY - drag.y;
		drag.travelled += Math.abs(dx) + Math.abs(dy);
		drag.x = e.clientX;
		drag.y = e.clientY;
		if (drag.key) {
			pos[drag.key] = { x: pos[drag.key].x + dx / view.k, y: pos[drag.key].y + dy / view.k };
		} else {
			view = { ...view, x: view.x + dx, y: view.y + dy };
		}
	}
</script>

<div class="wrap">
	{#if error}<p class="error">{error}</p>{/if}
	<div class="tools">
		{#if fks.some((f) => f.inferred)}
			<span class="legend" title="Drawn from a column like address_entity_id, which the database only links to org_entity">
				dashed = by entity id
			</span>
		{/if}
		<button onclick={fit}>fit</button>
		{#if focused && !isolated}<button onclick={isolate}>isolate</button>{/if}
		{#if isolated}<button onclick={leave}>show all</button>{/if}
		{#if anySelected}
			<button
				onclick={() => {
					leave();
					focused = null;
					selected = new Set();
				}}
			>
				clear
			</button>
		{/if}
	</div>

	<svg
		bind:this={svg}
		role="img"
		aria-label="Table relationships"
		onpointerdown={(e) => down(e, null)}
		onpointermove={move}
		onpointerup={up}
	>
		<g transform="translate({view.x} {view.y}) scale({view.k})">
			{#each edges as e (e.id)}
				<path
					d={e.d}
					class="edge"
					class:inferred={e.inferred}
					class:on={litFks.has(e.id)}
					class:dim={anySelected && !litFks.has(e.id)}
				/>
			{/each}

			{#each visibleTables as t (t.key)}
				<g
					class="node"
					class:dim={anySelected && !touched.has(t.key)}
					class:focus={focused === t.key}
					transform="translate({pos[t.key].x} {pos[t.key].y})"
				>
					<rect class="box" width={NODE_W} height={nodeHeight(t)} rx="4" />
					<g class="head" onpointerdown={(e) => down(e, t.key)} role="presentation">
						<rect width={NODE_W} height={HEADER} rx="4" />
						<text x="8" y="17">{t.schema}.{t.name}</text>
					</g>

					{#each t.columns as c, i}
						{@const isFk = fksByColumn.has(`${t.key}.${c.name}`)}
						<g
							class="row"
							class:fk={isFk}
							class:on={highlightedColumns.has(`${t.key}.${c.name}`)}
							transform="translate(0 {HEADER + i * ROW})"
							onclick={() => toggle(t.key, c.name)}
							onpointerdown={(e) => e.stopPropagation()}
							role="presentation"
						>
							<rect width={NODE_W} height={ROW} />
							<text x="8" y="12" class:pk={c.pk}>{c.name}</text>
							<text x={NODE_W - 8} y="12" class="type" text-anchor="end">{c.type}</text>
						</g>
					{/each}
				</g>
			{/each}
		</g>
	</svg>
</div>

<style>
	.wrap {
		position: relative;
		flex: 1;
		min-width: 0;
		min-height: 0;
		display: flex;
	}
	svg {
		flex: 1;
		width: 100%;
		height: 100%;
		cursor: grab;
		touch-action: none;
		user-select: none;
	}
	.tools {
		position: absolute;
		top: 8px;
		right: 12px;
		display: flex;
		gap: 6px;
		z-index: 1;
	}
	.tools button {
		font: inherit;
		font-size: 13px;
		padding: 2px 8px;
		border: 1px solid var(--border);
		background: var(--bg);
		color: var(--fg);
		border-radius: 4px;
		cursor: pointer;
	}
	.edge {
		fill: none;
		stroke: var(--faint);
		stroke-width: 1;
		vector-effect: non-scaling-stroke;
		opacity: 0.7;
	}
	.edge.inferred {
		stroke-dasharray: 5 4;
	}
	.legend {
		font-size: 12px;
		color: var(--faint);
		align-self: center;
	}
	.edge.dim {
		opacity: 0.06;
	}
	.edge.on {
		stroke: var(--accent);
		stroke-width: 1.5;
		opacity: 1;
	}
	.node {
		font-size: 11px;
		font-family: ui-monospace, monospace;
	}
	.node.dim {
		opacity: 0.2;
	}
	.node.focus .box {
		fill: var(--mark);
		stroke: var(--mark-border);
		stroke-width: 2;
	}
	.node.focus .head rect {
		fill: var(--mark);
		stroke: var(--mark-border);
	}
	.box {
		fill: var(--bg);
		stroke: var(--border);
		vector-effect: non-scaling-stroke;
	}
	.head {
		cursor: pointer;
	}
	.head rect {
		fill: var(--head);
		stroke: var(--border);
		vector-effect: non-scaling-stroke;
	}
	.head text {
		fill: var(--fg);
		font-weight: 600;
	}
	.row rect {
		fill: transparent;
	}
	.row text {
		fill: var(--fg);
	}
	.row text.pk {
		text-decoration: underline;
	}
	.row .type {
		fill: var(--faint);
	}
	.row.fk {
		cursor: pointer;
	}
	.row.fk text:first-of-type {
		fill: var(--accent);
	}
	.row.fk:hover rect {
		fill: var(--hover);
	}
	.row.on rect {
		fill: var(--sel);
	}
	.row.on text:first-of-type {
		font-weight: 700;
	}
	.error {
		position: absolute;
		margin: 8px 12px;
		color: var(--err);
	}
</style>
