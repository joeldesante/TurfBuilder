<script lang="ts">
	import type { Snippet } from 'svelte';

	interface PageMargins {
		left: string;
		right: string;
		top: string;
		bottom: string;
	}

	interface Props {
		type: 'Letter' | 'A4';
		margins?: PageMargins;
		showMarginGuides?: boolean;
		children: Snippet;
	}

	const {
		type,
		margins = {
			top: '1in',
			bottom: '1in',
			left: '1in',
			right: '1in'
		},
		showMarginGuides = false,
		children
	}: Props = $props();

	const dimensions = {
		Letter: { width: '8.5in', height: '11in' },
		A4: { width: '210mm', height: '297mm' }
	};

	const dim = $derived(dimensions[type]);
</script>

<div
	class="pdf-page"
	style:width={dim.width}
	style:height={dim.height}
	style:padding-left={margins.left}
	style:padding-right={margins.right}
	style:padding-top={margins.top}
	style:padding-bottom={margins.bottom}
>
	{#if showMarginGuides}
		<div
			class="margin-guide"
			style:top={margins.top}
			style:bottom={margins.bottom}
			style:left={margins.left}
			style:right={margins.right}
		>
			<p
				class="absolute -inset-y-[15px] -inset-x-px border-box text-xs tracking-wide"
				style:color="var(--color-primary)"
			>
				MARGINS
			</p>
		</div>
	{/if}
	{@render children()}
</div>

<style>
	.pdf-page {
		overflow: hidden;
		background: white;
		box-sizing: border-box;
		position: relative;
	}

	.margin-guide {
		position: absolute;
		border: 1px dashed var(--color-primary);
		pointer-events: none;
	}
</style>
