<script lang="ts">
	import type { Row } from './api';

	let {
		versions,
		selected,
		onselect
	}: { versions: Row[]; selected: number; onselect: (index: number) => void } = $props();

	const STEP = 40;
	const X = 14;

	const stamp = (v: unknown) =>
		v ? new Date(String(v)).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '';
</script>

<div class="graph" style:height="{versions.length * STEP + 8}px">
	<svg width="28" height={versions.length * STEP + 8}>
		<line x1={X} y1={STEP / 2 + 4} x2={X} y2={(versions.length - 1) * STEP + STEP / 2 + 4} />
		{#each versions as _, i}
			<circle
				cx={X}
				cy={i * STEP + STEP / 2 + 4}
				r={i === selected ? 6 : 4}
				class:on={i === selected}
			/>
		{/each}
	</svg>
	<ol>
		{#each versions as v, i}
			<li style:top="{i * STEP + 4}px" style:height="{STEP}px">
				<button class:on={i === selected} onclick={() => onselect(i)}>
					<span>{stamp(v.valid_from)}</span>
					{#if v.valid_to === null}<em>current</em>{/if}
				</button>
			</li>
		{/each}
	</ol>
</div>

<style>
	.graph {
		position: relative;
		min-width: 200px;
	}
	svg {
		position: absolute;
		left: 0;
		top: 0;
	}
	line {
		stroke: var(--faint);
		stroke-width: 2;
	}
	circle {
		fill: var(--bg);
		stroke: var(--fg);
		stroke-width: 2;
	}
	circle.on {
		fill: var(--fg);
	}
	ol {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	li {
		position: absolute;
		left: 34px;
		right: 0;
		display: flex;
		align-items: center;
	}
	button {
		all: unset;
		cursor: pointer;
		font-size: 13px;
		color: var(--muted);
		display: flex;
		gap: 8px;
		align-items: baseline;
	}
	button.on {
		color: var(--fg);
		font-weight: 600;
	}
	em {
		font-style: normal;
		font-size: 12px;
		color: var(--muted);
	}
</style>
