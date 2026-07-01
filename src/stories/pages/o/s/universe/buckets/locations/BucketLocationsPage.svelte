<script lang="ts">
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';
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
		bucketName: string;
		/** Whether the locations filter is enabled for this bucket. */
		enabled: boolean;
		locations: LocationRow[];
		/** Base path for location detail links, e.g. /o/myorg/s/universe/buckets/my-bucket/locations */
		basePath?: string;
	}

	const { bucketName, enabled, locations, basePath = '' }: Props = $props();

	function formatPrimary(row: LocationRow): string {
		if (row.name) return row.name;
		const parts = [row.address_line_1, row.address_line_2].filter(Boolean);
		return parts.join(', ') || 'Unknown Location';
	}

	function formatSecondary(row: LocationRow): string {
		const parts = [row.city, row.state_or_region, row.postal_code].filter(Boolean);
		return parts.join(', ');
	}
</script>

<div>
	<PageHeader title="Locations" subheading={bucketName} />

	{#if !enabled}
		<p class="text-on-surface-subtle mt-4">
			This bucket does not include a locations filter.
		</p>
	{:else if locations.length === 0}
		<p class="text-on-surface-subtle mt-4">
			No locations match the filters defined for this bucket.
		</p>
	{:else}
		<p class="text-sm text-on-surface-subtle my-4">
			{locations.length} {locations.length === 1 ? 'location' : 'locations'} matched
		</p>

		<div class="border-t border-outline-subtle">
			<div class="flex items-center gap-4 px-4 py-2">
				<div class="w-8 shrink-0"></div>
				<span class="flex-1 text-xs font-medium text-on-surface-subtle uppercase tracking-wide">Location</span>
			</div>

			{#each locations as location (location.id)}
				<a
					href="{basePath}/{location.id}"
					class="flex items-center gap-4 px-4 py-3 border-b border-outline-subtle hover:bg-surface-container transition-colors duration-100 group"
				>
					<div class="w-8 h-8 shrink-0 flex items-center justify-center text-on-surface-subtle">
						<MapPinIcon size={20} />
					</div>
					<div class="flex-1 min-w-0">
						<span class="block text-sm text-on-surface truncate group-hover:text-primary transition-colors">
							{formatPrimary(location)}
						</span>
						{#if formatSecondary(location)}
							<span class="block text-xs text-on-surface-subtle truncate mt-0.5">
								{formatSecondary(location)}
							</span>
						{/if}
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>
