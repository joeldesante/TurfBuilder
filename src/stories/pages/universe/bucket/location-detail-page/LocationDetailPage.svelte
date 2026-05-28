<script lang="ts">
	import PageHeader from '$components/layout/page-header/PageHeader.svelte';
	import ArrowLeftIcon from 'phosphor-svelte/lib/ArrowLeft';

	export interface LocationDetail {
		id: string;
		name: string | null;
		address_line_1: string | null;
		address_line_2: string | null;
		address_line_3: string | null;
		city: string | null;
		state_or_region: string | null;
		postal_code: string | null;
		country_code: string | null;
		source: 'public' | 'org';
	}

	interface Props {
		location: LocationDetail;
		/** URL to navigate back to the locations list. */
		backHref: string;
	}

	const { location, backHref }: Props = $props();

	function pageTitle(loc: LocationDetail): string {
		if (loc.name) return loc.name;
		const parts = [loc.address_line_1, loc.city, loc.state_or_region].filter(Boolean);
		return parts.join(', ') || 'Unknown Location';
	}

	interface Field {
		label: string;
		value: string | null | undefined;
	}

	const fields = $derived<Field[]>([
		{ label: 'Name', value: location.name },
		{ label: 'Address Line 1', value: location.address_line_1 },
		{ label: 'Address Line 2', value: location.address_line_2 },
		{ label: 'Address Line 3', value: location.address_line_3 },
		{ label: 'City', value: location.city },
		{ label: 'State / Region', value: location.state_or_region },
		{ label: 'Postal Code', value: location.postal_code },
		{ label: 'Country', value: location.country_code },
		{ label: 'Data Source', value: location.source === 'public' ? 'Public record' : 'Organization record' },
	].filter((f) => f.value));
</script>

<div class="pt-4">
	<a
		href={backHref}
		class="inline-flex items-center gap-1 text-sm text-on-surface-subtle hover:text-on-surface mb-4 transition-colors"
	>
		<ArrowLeftIcon size={14} />
		Back to Locations
	</a>

	<PageHeader title={pageTitle(location)} class="pt-0" />

	<dl class="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
		{#each fields as field}
			<div>
				<dt class="text-xs font-medium text-on-surface-subtle uppercase tracking-wide">{field.label}</dt>
				<dd class="mt-0.5 text-sm">{field.value}</dd>
			</div>
		{/each}
	</dl>
</div>
