<script lang="ts">
	import { CaretDownIcon, CaretLeftIcon } from 'phosphor-svelte';
	import type { Snippet } from 'svelte';
	import { fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	interface Props {
		label: string;
		children: Snippet;
	}

	let { label, children }: Props = $props();
	let collapsed = $state(false);

	function collapse(node: Element, { duration = 250 } = {}) {
		const style = getComputedStyle(node);
		const width = parseFloat(style.width);
		const height = parseFloat(style.height);
		const paddingTop = parseFloat(style.paddingTop);
		const paddingRight = parseFloat(style.paddingRight);
		const paddingBottom = parseFloat(style.paddingBottom);
		const paddingLeft = parseFloat(style.paddingLeft);

		return {
			duration,
			easing: cubicOut,
			css: (t: number) =>
				'overflow: hidden;' +
				`width: ${t * width}px;` +
				`height: ${t * height}px;` +
				`padding: ${t * paddingTop}px ${t * paddingRight}px ${t * paddingBottom}px ${t * paddingLeft}px;`
		};
	}
</script>

<div
	class="size-min z-10 rounded-lg border border-outline-subtle bg-surface-container-lowest shadow-md relative flex flex-col"
>
	<button
		class="flex justify-between items-center gap-3 cursor-pointer p-3 text-nowrap"
		onclick={() => (collapsed = !collapsed)}
	>
		<p class="text-xs font-semibold tracking-wide text-on-surface-subtle uppercase">
			{label.toUpperCase()}
		</p>
		<div>
			{#if collapsed}
				<CaretLeftIcon />
			{:else}
				<CaretDownIcon />
			{/if}
		</div>
	</button>
	{#if collapsed == false}
		<div class="p-3 pt-0" transition:collapse={{ duration: 1000 }}>
			<div transition:fade={{ duration: 250 }}>
				{@render children()}
			</div>
		</div>
	{/if}
</div>
