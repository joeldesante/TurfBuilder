<script lang="ts">
	import type { Snippet } from 'svelte';
	import { CaretDownIcon } from 'phosphor-svelte';
	import Card from '$components/layout/card/Card.svelte';

	/** A card whose body can be hidden by clicking its heading. */
	interface Props {
		title: string;
		/** Whether the body is shown. @default true */
		open?: boolean;
		/** Optional icon shown before the title. */
		icon?: Snippet;
		children: Snippet;
		class?: string;
	}

	let { title, open = $bindable(true), icon, children, class: className = '' }: Props = $props();

	const bodyId = $props.id();
</script>

<Card>
	<div class={['flex flex-col gap-2 w-full', className].filter(Boolean).join(' ')}>
		<button
			type="button"
			class="flex items-center justify-between w-full cursor-pointer text-left"
			aria-expanded={open}
			aria-controls={bodyId}
			onclick={() => (open = !open)}
		>
			<span class="flex items-center gap-2 text-base font-semibold text-on-surface">
				{#if icon}
					<span class="flex [&>svg]:size-5" aria-hidden="true">{@render icon()}</span>
				{/if}
				{title}
			</span>
			<CaretDownIcon
				class={['size-4 transition-transform', open ? 'rotate-180' : ''].join(' ')}
				aria-hidden="true"
			/>
		</button>
		{#if open}
			<div id={bodyId} class="flex flex-col gap-3 text-sm text-on-surface-subtle">
				{@render children()}
			</div>
		{/if}
	</div>
</Card>
