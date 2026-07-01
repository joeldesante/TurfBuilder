<script lang="ts">
	interface Row {
		color: string;
		label: string;
		value: string;
	}

	interface Props {
		heading: string;
		rows: Row[];
		/** Left offset in px relative to the nearest positioned ancestor. */
		x: number;
		/** Top offset in px relative to the nearest positioned ancestor. */
		y: number;
		/** When true the tooltip renders to the left of x instead of the right. */
		flip?: boolean;
	}

	let { heading, rows, x, y, flip = false }: Props = $props();
</script>

<div
	class="tooltip"
	style:left="{x}px"
	style:top="{y}px"
	style:transform={flip ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)'}
>
	<p class="heading">{heading}</p>
	{#each rows as row}
		<div class="row">
			<span class="dot" style:background={row.color}></span>
			<span class="label">{row.label}</span>
			<span class="value">{row.value}</span>
		</div>
	{/each}
</div>

<style>
	.tooltip {
		position: absolute;
		pointer-events: none;
		background: var(--surface-container, #1e1e1e);
		border: 1px solid var(--outline-subtle, #333);
		border-radius: 6px;
		padding: 8px 10px;
		min-width: 140px;
		font-size: 12px;
		line-height: 1.4;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
		z-index: 10;
	}

	.heading {
		font-size: 11px;
		color: var(--on-surface-subtle, #999);
		margin: 0 0 6px;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 4px;
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.label {
		flex: 1;
		color: var(--on-surface, #fff);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.value {
		font-weight: 600;
		color: var(--on-surface, #fff);
	}
</style>
