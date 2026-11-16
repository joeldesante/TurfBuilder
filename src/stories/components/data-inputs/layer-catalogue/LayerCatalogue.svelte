<script lang="ts">
	import SpinnerGapIcon from 'phosphor-svelte/lib/SpinnerGap';
	import Dropdown from '$components/data-inputs/dropdown/Dropdown.svelte';
	import TextInput from '$components/data-inputs/text-input/TextInput.svelte';
	import GeometryBadge from '$components/data-display/geometry-badge/GeometryBadge.svelte';
	import OfficialBadge from '$components/data-display/official-badge/OfficialBadge.svelte';
	import SourceBadge from '$components/data-display/source-badge/SourceBadge.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import {
		PROVIDER_NAMES,
		type CatalogueEntry,
		type CatalogueProvider
	} from '$lib/shared/registries/layer-catalogue';
	import { CITIES } from '$lib/shared/registries/cities';
	import { PROVIDERS, searchProvider, type Cursor } from '$lib/client/layer-search';
	import type { Bounds } from '$lib/shared/utils/geojson-bounds';

	/**
	 * Searches public map layers live: ArcGIS Hub (most cities and agencies), city portals on
	 * Socrata, data.gov and a few Census boundaries. Nothing is listed ahead of time, so it
	 * never goes out of date. Results cover everywhere by default, and can be narrowed to a US city or the map view, and by
	 * source, layer type and publisher. Picking one calls `onPick`.
	 */
	interface Props {
		/** The map's current view (west, south, east, north), to search near it. */
		getViewBounds?: () => Bounds | null;
		/** The id of the entry being loaded. Disables the list while set. */
		loadingId?: string | null;
		onPick: (entry: CatalogueEntry) => void;
	}

	const { getViewBounds, loadingId = null, onPick }: Props = $props();

	let query = $state('');
	let area = $state('everywhere');
	/** The id of the city results are limited to, or empty for any. */
	let city = $state('');
	/** `official` limits results to governments' own data portals. */
	let publisherType = $state('all');
	let source = $state('all');
	let kind = $state('all');
	let publisher = $state('');

	let entries = $state<CatalogueEntry[]>([]);
	let cursors = $state<Partial<Record<CatalogueProvider, { cursor: Cursor; more: boolean }>>>({});
	let loading = $state(false);
	let failed = $state<string[]>([]);
	/** Ignores the reply of a search that has since been replaced. */
	let searchId = 0;

	const activeProviders = $derived(
		source === 'all' ? PROVIDERS : PROVIDERS.filter((provider) => provider === source)
	);
	const canLoadMore = $derived(activeProviders.some((provider) => cursors[provider]?.more));

	async function run(fresh: boolean) {
		const mine = ++searchId;
		loading = true;
		const cityBounds = CITIES.find((c) => c.id === city)?.bounds ?? null;
		const params = {
			q: query,
			officialOnly: publisherType === 'official',
			// A chosen city wins over the area setting.
			area: cityBounds ?? (area === 'near' ? (getViewBounds?.() ?? null) : null)
		};
		const providers = fresh ? activeProviders : activeProviders.filter((p) => cursors[p]?.more);

		const settled = await Promise.allSettled(
			providers.map((provider) => searchProvider(provider, params, fresh ? null : cursors[provider]!.cursor))
		);
		if (mine !== searchId) return;

		const next = fresh ? [] : [...entries];
		const nextCursors = fresh ? {} : { ...cursors };
		const errors: string[] = [];
		settled.forEach((result, index) => {
			const provider = providers[index];
			if (result.status === 'fulfilled') {
				next.push(...result.value.entries);
				nextCursors[provider] = { cursor: result.value.next, more: result.value.hasMore };
			} else {
				errors.push(PROVIDER_NAMES[provider]);
				nextCursors[provider] = { cursor: null, more: false };
			}
		});
		entries = next;
		cursors = nextCursors;
		failed = errors;
		loading = false;
	}

	// Search again, shortly after typing stops or when the area or source changes.
	$effect(() => {
		void [query, area, source, city, publisherType];
		const timer = setTimeout(() => run(true), query ? 350 : 0);
		return () => clearTimeout(timer);
	});

	const visible = $derived(
		entries.filter(
			(entry) =>
				(kind === 'all' || entry.geometry === kind) &&
				(publisher === '' || entry.publisher === publisher) &&
				(publisherType !== 'official' || entry.official)
		)
	);

	const publishers = $derived.by(() => {
		const counts: Record<string, number> = {};
		for (const entry of entries) counts[entry.publisher] = (counts[entry.publisher] ?? 0) + 1;
		return Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
	});

	const sourceItems = [
		{ value: 'all', label: 'All sources' },
		...PROVIDERS.map((provider) => ({ value: provider, label: PROVIDER_NAMES[provider] }))
	];
	const kindItems = [
		{ value: 'all', label: 'Any layer type' },
		{ value: 'polygon', label: 'Polygons' },
		{ value: 'line', label: 'Lines' },
		{ value: 'point', label: 'Points' }
	];
	const cityItems = [
		{ value: '', label: 'Any city' },
		...CITIES.toSorted((a, b) => a.name.localeCompare(b.name)).map((c) => ({
			value: c.id,
			label: `${c.name}, ${c.region}`
		}))
	];
	const publisherItems = $derived([
		{ value: '', label: 'All publishers' },
		...publishers.map(([name, count]) => ({ value: name, label: `${name} (${count})` }))
	]);

	// A publisher that a new search no longer returns would leave the list empty with no way back.
	$effect(() => {
		if (publisher && !publishers.some(([name]) => name === publisher)) publisher = '';
	});
</script>

<div class="flex flex-col gap-3">
	<TextInput
		bind:value={query}
		type="search"
		placeholder="Search layers, such as wards, precincts or zip codes"
		aria-label="Search layers"
	/>

	<div class="grid grid-cols-2 gap-2 md:grid-cols-3">
		<Dropdown aria-label="City" bind:value={city} items={cityItems} class="w-full" />
		<Dropdown
			aria-label="Publisher type"
			bind:value={publisherType}
			items={[
				{ value: 'all', label: 'All publishers' },
				{ value: 'official', label: 'Official portals only' }
			]}
			class="w-full"
		/>
		<Dropdown
			aria-label="Area"
			bind:value={area}
			disabled={city !== ''}
			items={[
				{ value: 'everywhere', label: 'Everywhere' },
				{ value: 'near', label: 'Near the map' }
			]}
			class="w-full"
		/>
		<Dropdown aria-label="Source" bind:value={source} items={sourceItems} class="w-full" />
		<Dropdown aria-label="Layer type" bind:value={kind} items={kindItems} class="w-full" />
		<Dropdown aria-label="Publisher" bind:value={publisher} items={publisherItems} class="w-full" />
	</div>

	<div class="relative h-[min(28rem,50dvh)] overflow-y-auto rounded-md border border-outline-subtle" role="list" aria-label="Catalogue layers">
		{#each visible as entry (entry.id)}
			<div class="flex items-start border-b border-outline-subtle last:border-b-0 hover:bg-surface-container-high">
				<button
					type="button"
					role="listitem"
					class="flex min-w-0 flex-1 items-start gap-3 px-3 py-2 text-left outline-none focus-visible:bg-surface-container-high disabled:opacity-50"
					disabled={loadingId !== null}
					onclick={() => onPick(entry)}
				>
					<span class="min-w-0 flex-1">
						<span class="block text-sm font-medium text-on-surface">{entry.name}</span>
						<span class="block text-xs text-on-surface-subtle">
							{entry.publisher}{entry.count !== null ? ` \u00b7 ${entry.count.toLocaleString('en-US')} shapes` : ''}
						</span>
						{#if entry.description}
							<span class="mt-0.5 line-clamp-2 block text-xs text-on-surface-variant">{entry.description}</span>
						{/if}
					</span>
					{#if entry.geometry}
						<GeometryBadge kind={entry.geometry} />
					{/if}
					{#if loadingId === entry.id}
						<SpinnerGapIcon class="mt-0.5 size-4 shrink-0 animate-spin" aria-label="Loading" />
					{/if}
				</button>
				<div class="flex max-w-[40%] shrink-0 flex-col items-end gap-1 py-2 pr-3">
					<SourceBadge provider={entry.provider} href={entry.sourceUrl} />
					{#if entry.official}
						<OfficialBadge />
					{/if}
				</div>
			</div>
		{:else}
			{#if !loading}
				<p class="px-3 py-8 text-center text-sm text-on-surface-subtle">
					{#if entries.length > 0}
						Nothing matches these filters. Loosen them or load more results.
					{:else if query.trim()}
						No layers found for "{query.trim()}". Try other words{area === 'near' || city ? ', or widen the area' : ''}.
					{:else}
						Type to search, such as wards, precincts or zip codes.
					{/if}
				</p>
			{/if}
		{/each}

		{#if loading}
			<p class="flex items-center justify-center gap-2 px-3 py-4 text-sm text-on-surface-subtle" role="status">
				<SpinnerGapIcon class="size-4 animate-spin" /> Searching
			</p>
		{:else if canLoadMore}
			<div class="flex justify-center p-3">
				<Button variant="outline" size="sm" onclick={() => run(false)}>Load more results</Button>
			</div>
		{/if}
	</div>

	{#if failed.length > 0}
		<p role="alert" class="text-sm text-error">
			{failed.join(', ')} could not be searched just now. The other sources are shown.
		</p>
	{/if}
</div>
