<script lang="ts">
	import PageHeader from '$components/layout/page-header/PageHeader.svelte';
	import MapPinIcon from 'phosphor-svelte/lib/MapPin';

	export interface LocationRow {
		id: string;
		name: string | null;
		address_line_1: string | null;
		address_line_2: string | null;
		city: string | null;
		state_or_region: string | null;
		postal_code: string | null;
	}

	interface Props {
		orgSlug: string;
		totalCount: number;
		locations: LocationRow[];
	}

	const { orgSlug, totalCount, locations }: Props = $props();

	function formatPrimary(row: LocationRow): string {
		if (row.name) return row.name;
		const parts = [row.address_line_1, row.address_line_2].filter(Boolean);
		return parts.join(', ') || 'Unknown Location';
	}

	function formatSecondary(row: LocationRow): string {
		return [row.city, row.state_or_region, row.postal_code].filter(Boolean).join(', ');
	}
</script>

<PageHeader
	title="Locations"
	subheading="All location records in this organization's universe."
/>

<div class="border-t border-outline-subtle">
	<div class="flex items-center gap-4 px-4 py-2">
		<div class="w-8 shrink-0"></div>
		<span class="flex-1 text-xs font-medium text-on-surface-subtle uppercase tracking-wide">Location</span>
	</div>

	{#each locations as location (location.id)}
		<div class="flex items-center gap-4 px-4 py-3 border-b border-outline-subtle">
			<div class="w-8 h-8 shrink-0 flex items-center justify-center text-on-surface-subtle">
				<MapPinIcon size={20} />
			</div>
			<div class="flex-1 min-w-0">
				<span class="block text-sm text-on-surface truncate">
					{formatPrimary(location)}
				</span>
				{#if formatSecondary(location)}
					<span class="block text-xs text-on-surface-subtle truncate mt-0.5">
						{formatSecondary(location)}
					</span>
				{/if}
			</div>
		</div>
	{:else}
		<p class="px-4 py-8 text-sm text-on-surface-subtle text-center">No location records found.</p>
	{/each}

	{#if locations.length < totalCount}
		<p class="px-4 py-3 text-xs text-on-surface-subtle text-center">
			Showing {locations.length.toLocaleString()} of {totalCount.toLocaleString()} records.
			Use <a href="/o/{orgSlug}/s/universe/search" class="underline hover:text-on-surface">Quick Search</a> to filter.
		</p>
	{/if}
</div>
