<script lang="ts" module>
	export interface LocationRow {
		id: string;
		entity_id: string;
		name: string | null;
		address_line_1: string | null;
		address_line_2: string | null;
		city: string | null;
		state_or_region: string | null;
		postal_code: string | null;
		country_code?: string | null;
		latitude: number | null;
		longitude: number | null;
		photo_keys?: string[];
		suggestion_status?: 'tentative' | 'approved' | null;
	}

	export interface Props {
		orgSlug: string;
		totalCount: number;
		locations: LocationRow[];
		canCreate?: boolean;
		canUpdate?: boolean;
		canDelete?: boolean;
		onCreate?: (fields: LocationFields) => Promise<void>;
		onUpdate?: (entityId: string, fields: LocationFields) => Promise<void>;
		onDelete?: (entityId: string) => Promise<void>;
	}
</script>

<script lang="ts">
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';
	import MapPinIcon from 'phosphor-svelte/lib/MapPin';
	import DropdownMenu from '$components/actions/dropdown-menu/DropdownMenu.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import UploadSimpleIcon from 'phosphor-svelte/lib/UploadSimple';
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDown';
	import PlusIcon from 'phosphor-svelte/lib/Plus';
	import TrashIcon from 'phosphor-svelte/lib/Trash';
	import PencilSimpleIcon from 'phosphor-svelte/lib/PencilSimple';
	import XIcon from 'phosphor-svelte/lib/X';
	import Badge from '$components/data-display/badge/Badge.svelte';
	import LocationsMap, {
		type MapLocation
	} from '$components/data-display/locations-map/LocationsMap.svelte';
	import LocationForm from '$components/data-inputs/location-form/LocationForm.svelte';
	import ConfirmDialog from '$components/feedback/confirm-dialog/ConfirmDialog.svelte';
	import type { LocationFields } from '$lib/schemas/location';

	const {
		orgSlug,
		totalCount,
		locations,
		canCreate = false,
		canUpdate = false,
		canDelete = false,
		onCreate,
		onUpdate,
		onDelete
	}: Props = $props();

	const importItems = $derived([
		{ label: 'Overture', href: `/o/${orgSlug}/s/universe/data/locations/import/overture` },
		{
			label: 'Google Sheets',
			href: `/o/${orgSlug}/s/universe/data/locations/import/google-sheets`
		},
		{ label: 'CSV or Excel', href: `/o/${orgSlug}/s/universe/data/locations/import/csv` }
	]);

	let view = $state<'list' | 'map'>('list');

	/** Set while placing a new pin; holds the dropped coordinates. */
	let draft = $state<{ latitude: number; longitude: number } | null>(null);
	let placing = $state(false);

	let editing = $state<LocationRow | null>(null);
	let deleting = $state<LocationRow | null>(null);
	let deleteError = $state<string | null>(null);
	let deleteBusy = $state(false);
	let selectedLocationId = $state<string | null>(null);

	// Only locations with coordinates can be drawn.
	const mapLocations: MapLocation[] = $derived(
		locations
			.filter((l) => l.latitude !== null && l.longitude !== null)
			.map((l) => ({
				id: l.entity_id,
				name: l.name,
				address_line_1: l.address_line_1,
				city: l.city,
				latitude: l.latitude as number,
				longitude: l.longitude as number
			}))
	);

	const byEntityId = $derived(new Map(locations.map((l) => [l.entity_id, l])));

	function formatPrimary(row: LocationRow): string {
		if (row.name) return row.name;
		const parts = [row.address_line_1, row.address_line_2].filter(Boolean);
		return parts.join(', ') || 'Unknown Location';
	}

	function formatSecondary(row: LocationRow): string {
		return [row.city, row.state_or_region, row.postal_code].filter(Boolean).join(', ');
	}

	function startPlacing() {
		view = 'map';
		placing = true;
		draft = null;
		editing = null;
	}

	function cancelPlacing() {
		placing = false;
		draft = null;
	}

	async function handleCreate(fields: LocationFields) {
		await onCreate?.(fields);
		cancelPlacing();
	}

	async function handleUpdate(fields: LocationFields) {
		const target = editing;
		if (!target) return;
		await onUpdate?.(target.entity_id, fields);
		editing = null;
	}

	async function confirmDelete() {
		const target = deleting;
		if (!target) return;
		deleteBusy = true;
		deleteError = null;
		try {
			await onDelete?.(target.entity_id);
			deleting = null;
		} catch (e) {
			deleteError = e instanceof Error ? e.message : 'Failed to delete location.';
		} finally {
			deleteBusy = false;
		}
	}
</script>

<PageHeader title="Locations" subheading="All location records in this organization's universe.">
	<!-- Direct children of the actions snippet: PageHeader sizes them with `*:`
	     variants, which a wrapper element would absorb instead. -->
	{#snippet actions()}
		<div
			class="flex items-center rounded-md border border-outline p-0.5"
			role="group"
			aria-label="View"
		>
			<button
				class={[
					'flex-1 rounded px-2.5 py-1 text-sm transition-colors',
					view === 'list' ? 'bg-surface-container text-on-surface' : 'text-on-surface-subtle'
				].join(' ')}
				aria-pressed={view === 'list'}
				onclick={() => (view = 'list')}
			>
				List
			</button>
			<button
				class={[
					'flex-1 rounded px-2.5 py-1 text-sm transition-colors',
					view === 'map' ? 'bg-surface-container text-on-surface' : 'text-on-surface-subtle'
				].join(' ')}
				aria-pressed={view === 'map'}
				onclick={() => (view = 'map')}
			>
				Map
			</button>
		</div>

		{#if canCreate}
			<Button variant="primary" onclick={startPlacing}>
				<PlusIcon />
				Add location
			</Button>
		{/if}

		<!-- Wrapped because DropdownMenu's trigger is w-full, which would otherwise
		     resolve against the whole actions row and push this off the edge. -->
		<div>
			<DropdownMenu items={importItems}>
				<Button variant="outline">
					<UploadSimpleIcon />
					Import
					<CaretDownIcon />
				</Button>
			</DropdownMenu>
		</div>
	{/snippet}
</PageHeader>

{#if view === 'map'}
	<div class="border-t border-outline-subtle">
		{#if placing}
			<div
				class="flex items-center justify-between gap-4 border-b border-outline-subtle bg-surface-container px-4 py-2"
			>
				<p class="text-sm text-on-surface">
					{draft
						? 'Fill in the details below, or click the map again to move the pin.'
						: 'Click the map to place the new location.'}
				</p>
				<Button variant="ghost" size="sm" onclick={cancelPlacing}>
					<XIcon />
					Cancel
				</Button>
			</div>
		{/if}

		<div class="flex flex-col lg:flex-row">
			<LocationsMap
				bind:selectedLocationId
				locations={mapLocations}
				pinDropMode={placing}
				onPinDrop={(coords) => (draft = coords)}
				draftPin={draft}
				onDraftMove={(coords) => (draft = coords)}
				autoFit={!placing}
				class="h-[32rem] flex-1"
			>
				{#snippet popup(loc)}
					{@const row = byEntityId.get(loc.id)}
					<div class="min-w-48 space-y-2">
						<div>
							<p class="font-semibold">{loc.name ?? 'Unknown Location'}</p>
							{#if row && formatSecondary(row)}
								<p class="text-xs text-on-surface-subtle">{formatSecondary(row)}</p>
							{/if}
						</div>
						{#if row}
							<div class="flex gap-1">
								{#if canUpdate}
									<Button
										variant="outline"
										size="sm"
										onclick={() => {
											editing = row;
											placing = false;
										}}
									>
										<PencilSimpleIcon />
										Edit
									</Button>
								{/if}
								{#if canDelete}
									<Button
										variant="ghost"
										size="sm"
										onclick={() => {
											deleting = row;
											deleteError = null;
										}}
									>
										<TrashIcon />
										Delete
									</Button>
								{/if}
							</div>
						{/if}
					</div>
				{/snippet}
			</LocationsMap>

			{#if draft || editing}
				<aside
					class="w-full shrink-0 border-t border-outline-subtle p-4 lg:w-96 lg:border-t-0 lg:border-l"
				>
					<h2 class="mb-4 text-base font-semibold">
						{editing ? 'Edit location' : 'New location'}
					</h2>
					{#if editing}
						{#key editing.entity_id}
							<LocationForm
								initialValues={{
									name: editing.name,
									address_line_1: editing.address_line_1,
									address_line_2: editing.address_line_2,
									city: editing.city,
									state_or_region: editing.state_or_region,
									postal_code: editing.postal_code,
									country_code: editing.country_code,
									photo_keys: editing.photo_keys ?? []
								}}
								coordinates={{
									latitude: editing.latitude ?? 0,
									longitude: editing.longitude ?? 0
								}}
								{orgSlug}
								submitLabel="Save changes"
								onSubmit={handleUpdate}
								onCancel={() => (editing = null)}
							/>
						{/key}
					{:else if draft}
						<LocationForm
							coordinates={draft}
							{orgSlug}
							submitLabel="Add location"
							onSubmit={handleCreate}
							onCancel={cancelPlacing}
						/>
					{/if}
				</aside>
			{/if}
		</div>
	</div>
{:else}
	<div class="border-t border-outline-subtle">
		<div class="flex items-center gap-4 px-4 py-2">
			<div class="w-8 shrink-0"></div>
			<span class="flex-1 text-xs font-medium text-on-surface-subtle uppercase tracking-wide"
				>Location</span
			>
			{#if canDelete}
				<div class="w-10 shrink-0"></div>
			{/if}
		</div>

		{#each locations as location (location.id)}
			<div class="flex items-center gap-4 px-4 py-3 border-b border-outline-subtle">
				<div class="w-8 h-8 shrink-0 flex items-center justify-center text-on-surface-subtle">
					<MapPinIcon size={20} />
				</div>
				<div class="flex-1 min-w-0">
					<span class="flex items-center gap-2 text-sm text-on-surface">
						<span class="truncate">{formatPrimary(location)}</span>
						{#if location.suggestion_status === 'tentative'}
							<Badge variant="warning" size="sm">Tentative</Badge>
						{/if}
					</span>
					{#if formatSecondary(location)}
						<span class="block text-xs text-on-surface-subtle truncate mt-0.5">
							{formatSecondary(location)}
						</span>
					{/if}
				</div>
				{#if canDelete}
					<Button
						variant="ghost"
						size="sm"
						iconOnly
						aria-label="Delete {formatPrimary(location)}"
						onclick={() => {
							deleting = location;
							deleteError = null;
						}}
					>
						<TrashIcon />
					</Button>
				{/if}
			</div>
		{:else}
			<p class="px-4 py-8 text-sm text-on-surface-subtle text-center">No location records found.</p>
		{/each}

		{#if locations.length < totalCount}
			<p class="px-4 py-3 text-xs text-on-surface-subtle text-center">
				Showing {locations.length.toLocaleString()} of {totalCount.toLocaleString()} records. Use
				<a href="/o/{orgSlug}/s/universe/search" class="underline hover:text-on-surface"
					>Quick Search</a
				> to filter.
			</p>
		{/if}
	</div>
{/if}

<ConfirmDialog
	open={deleting !== null}
	title="Delete this location?"
	description={deleting
		? `${formatPrimary(deleting)} will be removed from your universe, lists, and turf maps. Its version history and any canvassing responses against it are kept.`
		: ''}
	confirmLabel="Delete"
	destructive
	loading={deleteBusy}
	error={deleteError}
	onConfirm={confirmDelete}
	onCancel={() => (deleting = null)}
/>
