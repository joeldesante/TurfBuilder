<script lang="ts" module>
	/** A layer as the toggle list shows it. */
	export interface ToggleLayer {
		id: string;
		name: string;
		color: string;
	}

	/** Past this many layers the list gets a search box. */
	export const SEARCH_THRESHOLD = 8;
</script>

<script lang="ts">
	import StackIcon from 'phosphor-svelte/lib/Stack';
	import XIcon from 'phosphor-svelte/lib/X';
	import EyeIcon from 'phosphor-svelte/lib/Eye';
	import EyeSlashIcon from 'phosphor-svelte/lib/EyeSlash';
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlass';
	import Spinner from '$components/feedback/spinner/Spinner.svelte';

	/**
	 * A floating button over a map that opens a list of its layers, each of which
	 * can be turned on and off. The list scrolls, and past SEARCH_THRESHOLD
	 * layers it can be searched, so it stays usable with hundreds of layers.
	 * "Show all" and "Hide all" act on the layers the search leaves in view.
	 * Place it in a box with a height (such as one pinned to the map's top and
	 * bottom): the open list shrinks to fit it and scrolls.
	 */
	interface Props {
		layers: ToggleLayer[];
		/** Whether a layer is drawn now. */
		isOn: (layer: ToggleLayer) => boolean;
		/** Whether a layer is still loading, which its row shows with a spinner. */
		isLoading?: (layer: ToggleLayer) => boolean;
		/** Turns the given layers on or off. */
		onToggle: (ids: string[], on: boolean) => void;
		/** Bindable. Whether the list is open. Starts closed. */
		open?: boolean;
		class?: string;
	}

	let { layers, isOn, isLoading = () => false, onToggle, open = $bindable(false), class: className = '' }: Props = $props();

	const uid = $props.id();
	let query = $state('');
	let toggleButton = $state<HTMLButtonElement>();

	const searchable = $derived(layers.length > SEARCH_THRESHOLD);
	const shown = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return searchable && q ? layers.filter((l) => l.name.toLowerCase().includes(q)) : layers;
	});
	const allOn = $derived(shown.length > 0 && shown.every(isOn));

	function close() {
		open = false;
		toggleButton?.focus();
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.stopPropagation();
			close();
		}
	}
</script>

<div class="flex min-h-0 flex-col items-end gap-2 {className}">
	<button
		bind:this={toggleButton}
		type="button"
		aria-label="Layers"
		aria-expanded={open}
		onclick={() => (open = !open)}
		class="pointer-events-auto flex size-10 shrink-0 items-center justify-center rounded-full bg-surface/90 shadow-lg ring-1 ring-black/5 backdrop-blur transition hover:bg-surface inverse-on-map {open
			? 'text-primary'
			: 'text-on-surface'}"
	>
		<StackIcon class="size-5" weight={open ? 'fill' : 'regular'} />
	</button>

	{#if open}
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
			role="group"
			aria-labelledby="{uid}-title"
			onkeydown={onKeydown}
			class="inverse-on-map pointer-events-auto flex max-h-[28rem] min-h-0 w-64 flex-col overflow-hidden rounded-2xl bg-surface/95 text-on-surface shadow-xl ring-1 ring-black/5 backdrop-blur"
		>
			<div class="flex shrink-0 items-center gap-1 py-1.5 pr-1.5 pl-3.5">
				<h2 id="{uid}-title" class="flex-1 text-sm font-semibold">Layers</h2>
				<button
					type="button"
					disabled={shown.length === 0}
					onclick={() => onToggle(shown.map((l) => l.id), !allOn)}
					class="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-surface-container disabled:opacity-40"
				>
					{allOn ? 'Hide all' : 'Show all'}
				</button>
				<button
					type="button"
					aria-label="Close layers"
					onclick={close}
					class="flex size-7 shrink-0 items-center justify-center rounded-lg text-on-surface-subtle hover:bg-surface-container"
				>
					<XIcon class="size-3.5" />
				</button>
			</div>

			{#if searchable}
				<label class="mx-1.5 mb-1.5 flex shrink-0 items-center gap-1.5 rounded-lg bg-surface-container px-2 py-1">
					<MagnifyingGlassIcon class="size-3.5 shrink-0 text-on-surface-subtle" />
					<input
						type="search"
						bind:value={query}
						placeholder="Search layers"
						aria-label="Search layers"
						class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-on-surface-subtle"
					/>
				</label>
			{/if}

			<ul class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 pb-1.5">
				{#each shown as layer (layer.id)}
					{@const on = isOn(layer)}
					<li>
						<button
							type="button"
							role="checkbox"
							aria-checked={on}
							onclick={() => onToggle([layer.id], !on)}
							class="flex h-8 w-full items-center gap-2.5 rounded-lg px-2 text-left text-sm transition hover:bg-surface-container {on
								? ''
								: 'text-on-surface-subtle'}"
						>
							<span
								class="size-3 shrink-0 rounded-full ring-2 ring-surface transition {on ? '' : 'opacity-30'}"
								style="background-color: {layer.color};"
							></span>
							<span class="min-w-0 flex-1 truncate">{layer.name}</span>
							{#if isLoading(layer)}
								<span class="shrink-0" aria-label="Loading"><Spinner size={14} /></span>
							{:else if on}
								<EyeIcon class="size-3.5 shrink-0 text-on-surface-subtle" />
							{:else}
								<EyeSlashIcon class="size-3.5 shrink-0" />
							{/if}
						</button>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>

<style>
	/* The button and card take the opposite theme to the page, so they stand out
	   on the map: dark over the light map, white over the dark one. The theme
	   colors they use are reset here; the utilities read them where they are
	   used, so everything inside follows. Keep in step with app.css. */
	.inverse-on-map {
		color-scheme: dark;
		--primary: var(--color-emerald-500);
		--surface: var(--color-zinc-900);
		--on-surface: var(--color-zinc-100);
		--on-surface-subtle: var(--color-zinc-400);
		--surface-container: var(--color-zinc-800);
	}
	:global([data-theme='dark']) .inverse-on-map {
		color-scheme: light;
		--primary: var(--color-emerald-700);
		--surface: var(--color-white);
		--on-surface: var(--color-zinc-900);
		--on-surface-subtle: var(--color-zinc-600);
		--surface-container: var(--color-zinc-100);
	}
</style>
