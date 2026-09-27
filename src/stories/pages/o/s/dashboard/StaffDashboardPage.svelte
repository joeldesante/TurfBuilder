<script lang="ts">
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import DropdownMenu, { type DropdownMenuEntry } from '$components/actions/dropdown-menu/DropdownMenu.svelte';
	import ToggleGroup from '$components/data-inputs/toggle-group/ToggleGroup.svelte';
	import ActivityMap from '$components/data-display/activity-map/ActivityMap.svelte';
	import XIcon from 'phosphor-svelte/lib/X';
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDown';
	import GlobeIcon from 'phosphor-svelte/lib/Globe';
	import StackIcon from 'phosphor-svelte/lib/Stack';
	import type { DashboardProgress, DashboardPoint } from '$lib/server/dashboard';
	import { rangeLabel, type DashboardRange } from '$lib/dashboard-range';

	interface Props {
		orgSlug: string;
		/** The organization's buckets. */
		buckets: { id: string; slug: string; name: string }[];
		/** Visited and total counts for the selected scope. */
		progress: DashboardProgress;
		/** Locations for the map. */
		mapPoints: DashboardPoint[];
		/** Slug of the bucket to show, from the URL. Null or unknown shows the entire universe. */
		bucketSlug?: string | null;
		/** Called with the chosen bucket's slug, or null for the entire universe, so the route can put it in the URL. */
		onBucketChange?: (slug: string | null) => void;
		/** Time range from the URL: 'all' (the default) or <number><unit>, e.g. 24h, 27d, 6w, 3m, 1y. */
		range?: DashboardRange;
		/** Called with the chosen range, so the route can put it in the URL. */
		onRangeChange?: (range: DashboardRange) => void;
	}

	const { orgSlug, buckets, progress, mapPoints, bucketSlug = null, onBucketChange, range = 'all', onRangeChange }: Props = $props();

	const ALL = 'all';

	const RANGE_PRESETS = [
		{ value: '7d', label: '7 days' },
		{ value: '30d', label: '30 days' },
		{ value: 'all', label: 'All time' }
	];
	// A range from the URL that is not a preset gets its own item, so the toggle always shows what is applied.
	let rangeItems = $derived(
		RANGE_PRESETS.some((p) => p.value === range)
			? RANGE_PRESETS
			: [{ value: range, label: rangeLabel(range) }, ...RANGE_PRESETS]
	);
	const fromSlug = (slug: string | null) => buckets.find((b) => b.slug === slug)?.id ?? ALL;
	let bucket = $state(ALL);

	// Follow the URL, including back and forward.
	$effect(() => {
		bucket = fromSlug(bucketSlug);
	});

	function chooseBucket(id: string) {
		bucket = id;
		onBucketChange?.(buckets.find((b) => b.id === id)?.slug ?? null);
	}
	let selectedId = $state<string | null>(null);

	const base = $derived(`/o/${orgSlug}/s`);
	const universe = $derived(bucket === ALL);
	const currentBucket = $derived(buckets.find((b) => b.id === bucket) ?? null);

	let bucketItems = $derived<DropdownMenuEntry[]>([
		{ label: 'Entire Universe', icon: GlobeIcon, active: universe, onclick: () => chooseBucket(ALL) },
		{ separator: true },
		...buckets.map((b) => ({
			label: b.name,
			icon: StackIcon,
			active: bucket === b.id,
			onclick: () => chooseBucket(b.id)
		}))
	]);

	const pct = (n: number, d: number) => Math.round((n / Math.max(d, 1)) * 100);
	let visitedPct = $derived(pct(progress.visited, progress.total));
	let answerRate = $derived(pct(progress.answeredVisits, progress.visits));

	let selected = $derived(mapPoints.find((p) => p.id === selectedId) ?? null);

	const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
	function ago(iso: string) {
		const hours = Math.round((new Date(iso).getTime() - Date.now()) / 3_600_000);
		if (Math.abs(hours) < 24) return relative.format(hours, 'hour');
		return relative.format(Math.round(hours / 24), 'day');
	}

	$effect(() => {
		// Drop a selection the new bucket does not include.
		if (selectedId && !mapPoints.some((p) => p.id === selectedId)) {
			selectedId = null;
		}
	});
</script>

<div class="flex flex-col gap-6">
	<PageHeader title="Dashboard">
		{#snippet actions()}
			<!-- Wrapped because DropdownMenu's trigger is w-full, as on the locations page. -->
			<div>
				<DropdownMenu items={bucketItems}>
					<Button variant="outline" aria-label="Showing {currentBucket?.name ?? 'Entire Universe'}. Change bucket">
						{#if universe}<GlobeIcon />{:else}<StackIcon />{/if}
						{currentBucket?.name ?? 'Entire Universe'}
						<CaretDownIcon />
					</Button>
				</DropdownMenu>
			</div>
		{/snippet}
	</PageHeader>

	<ToggleGroup
		label="Time range"
		bind:value={() => range, (v) => v && onRangeChange?.(v as DashboardRange)}
		items={rangeItems}
	/>

	<!-- Progress -->
	<section aria-label="Progress" class="grid gap-6 rounded-lg border border-outline-subtle bg-surface-container-lowest p-5 sm:grid-cols-2">
		<div class="flex flex-col gap-1.5">
			<p class="text-sm text-on-surface-subtle">Locations visited</p>
			<p class="text-3xl font-semibold tabular-nums">
				{progress.visited.toLocaleString()}
				<span class="text-base font-normal text-on-surface-subtle">of {progress.total.toLocaleString()}</span>
			</p>
			<div class="h-2 rounded-sm bg-surface-container" role="img" aria-label="{visitedPct}% visited">
				<div class="h-2 rounded-sm bg-primary" style="width: {visitedPct}%"></div>
			</div>
			<p class="text-xs text-on-surface-subtle">
				{visitedPct}% of {universe ? 'your universe' : 'this bucket'}. {(progress.total - progress.visited).toLocaleString()} left to visit.
			</p>
		</div>
		<div class="flex flex-col gap-1.5 sm:border-l sm:border-outline-subtle sm:pl-6">
			<p class="text-sm text-on-surface-subtle">Conversations</p>
			<p class="text-3xl font-semibold tabular-nums">{progress.conversations}</p>
			<p class="text-xs text-on-surface-subtle">
				{#if progress.visits > 0}
					Someone answered at {answerRate}% of visits{range === 'all' ? `. ${progress.recentConversations} in the last 30 days` : ''}.
				{:else}
					No visits {range === 'all' ? 'yet' : `in the ${rangeLabel(range).toLowerCase()}`}.
				{/if}
			</p>
		</div>
	</section>

	<!-- Map, with the selected location beside it -->
	<div class="grid gap-6 xl:grid-cols-3">
		<section class="flex flex-col gap-3 rounded-lg border border-outline-subtle bg-surface-container-lowest p-5 {selected ? 'xl:col-span-2' : 'xl:col-span-3'}">
			<h2 class="text-base font-semibold">Where canvassers have been</h2>
			<ActivityMap points={mapPoints} bind:selectedId class="h-[560px] overflow-hidden rounded-sm" />
			<div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-on-surface-subtle">
				<span class="flex items-center gap-2">
					Fewer visits
					<span class="h-2.5 w-28 rounded-sm bg-gradient-to-r from-surface-container via-[#00bc7d] to-[#004f3b]"></span>
					More visits
				</span>
				<span class="flex items-center gap-1.5"><span class="size-2.5 rounded-full bg-location-contacted"></span>Talked to someone</span>
				<span class="flex items-center gap-1.5"><span class="size-1.5 rounded-full bg-on-surface-subtle"></span>No one to talk to</span>
				<span class="flex items-center gap-1.5"><span class="size-2 rounded-full border-[1.5px] border-[#2b7fff] bg-surface"></span>Not visited yet</span>
			</div>
		</section>

		{#if selected}
			<aside aria-label={selected.name ?? 'Location'} class="flex flex-col gap-3 rounded-lg border border-outline-subtle bg-surface-container-lowest p-5">
				<div class="flex items-start justify-between gap-3">
					<div>
						<h2 class="text-xl font-semibold">{selected.name ?? 'Unnamed location'}</h2>
						{#if selected.address}<p class="text-sm text-on-surface-subtle">{selected.address}</p>{/if}
					</div>
					<Button variant="ghost" size="sm" iconOnly aria-label="Close" onclick={() => (selectedId = null)}>
						<XIcon />
					</Button>
				</div>
				<div class="flex flex-col gap-1 rounded-sm bg-surface-container p-3 text-sm">
					{#if selected.status === 'unvisited'}
						<span class="font-semibold">Not visited yet{universe ? '' : ' for this bucket'}</span>
					{:else}
						<span class="font-semibold">{selected.status === 'contacted' ? 'Talked to someone' : 'Visited, no one to talk to'}</span>
						<span class="text-on-surface-subtle">
							{selected.visits} {selected.visits === 1 ? 'visit' : 'visits'}, the latest {ago(selected.lastVisitAt ?? '')}.
						</span>
					{/if}
				</div>
				<div>
					<Button variant="outline" size="sm" href="{base}/universe/entity/{selected.id}">Open location</Button>
				</div>
			</aside>
		{/if}
	</div>
</div>
