<script lang="ts" module>
	export type TurfLocation = {
		id: string;
		location_name: string;
		visited: boolean | null;
		contact_made: boolean | null;
		latitude: number;
		longitude: number;
		street: string | null;
		locality: string | null;
		postcode: string | null;
		region: string | null;
		country: string | null;
		/** Null for locations that came from the turf cut rather than the field. */
		entity_id?: string | null;
		is_tentative?: boolean | null;
		/** True only for the caller's own unreviewed additions. */
		is_mine?: boolean | null;
		street_2?: string | null;
		/** True when the caller already has a correction awaiting review here. */
		has_pending_edit?: boolean | null;
	};

	export interface Props {
		orgSlug: string;
		turfId: string;
		locations: TurfLocation[];
		center: { lat: number; lng: number };
		/** Turf outline, drawn so the volunteer sees where a pin is allowed. */
		bounds?: GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
		/** False once the turf expires; the add control is hidden. */
		canSuggest?: boolean;
		onSuggest?: (fields: LocationFields) => Promise<void>;
		onEditSuggestion?: (entityId: string, fields: LocationFields) => Promise<void>;
		onDeleteSuggestion?: (entityId: string) => Promise<void>;
		/** Proposes a correction to a door that already exists. */
		onProposeEdit?: (turfLocationId: string, proposal: LocationEditProposal) => Promise<void>;
	}
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import ArrowLeftIcon from 'phosphor-svelte/lib/ArrowLeft';
	import GpsIcon from 'phosphor-svelte/lib/Gps';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import LocationsMap, {
		type MapLocation
	} from '$components/data-display/locations-map/LocationsMap.svelte';
	import { type Variant } from '$components/data-display/map-marker/MapMarker.svelte';
	import Badge from '$components/data-display/badge/Badge.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import LocationForm from '$components/data-inputs/location-form/LocationForm.svelte';
	import ConfirmDialog from '$components/feedback/confirm-dialog/ConfirmDialog.svelte';
	import StorefrontIcon from 'phosphor-svelte/lib/Storefront';
	import PencilSimpleIcon from 'phosphor-svelte/lib/PencilSimple';
	import TrashIcon from 'phosphor-svelte/lib/Trash';
	import PencilLineIcon from 'phosphor-svelte/lib/PencilLine';
	import type { LocationFields, LocationEditProposal } from '$lib/schemas/location';

	const {
		orgSlug,
		turfId,
		locations,
		center,
		bounds = null,
		canSuggest = false,
		onSuggest,
		onEditSuggestion,
		onDeleteSuggestion,
		onProposeEdit
	}: Props = $props();

	function deriveVariant(visited: boolean, contact_made: boolean): Variant {
		if (visited && contact_made) {
			return 'contacted';
		}

		if (visited && !contact_made) {
			return 'no-contact';
		}

		return 'unvisited';
	}

	const variantBadgeProps: Record<
		Variant,
		{
			label: string;
			variant:
				| 'location-unvisited'
				| 'location-contacted'
				| 'location-no-contact'
				| 'location-hostile';
		}
	> = {
		unvisited: { label: 'Unvisited', variant: 'location-unvisited' },
		contacted: { label: 'Contacted', variant: 'location-contacted' },
		'no-contact': { label: 'No Contact', variant: 'location-no-contact' },
		hostile: { label: 'Hostile', variant: 'location-hostile' }
	};

	let mapRef = $state<ReturnType<typeof LocationsMap> | undefined>();
	let selectedLocationId = $state<string | null>(null);

	type GeolocateState = 'idle' | 'locating' | 'tracking' | 'error';
	let geolocateState = $state<GeolocateState>('idle');
	let watchId: number | null = null;
	let userPosition = $state<{ latitude: number; longitude: number } | null>(null);

	// Visit status is polled separately from the location list so a teammate's
	// knock recolours the map without a reload.
	let statusMap = $state<Record<string, { visited: boolean; contact_made: boolean | null }>>(
		Object.fromEntries(
			locations.map((l) => [l.id, { visited: l.visited ?? false, contact_made: l.contact_made }])
		)
	);

	const mapLocations: MapLocation[] = $derived(
		locations.map((l) => ({
			id: l.id,
			name: l.location_name,
			address_line_1: l.street,
			city: l.locality,
			latitude: l.latitude,
			longitude: l.longitude
		}))
	);

	const selectedLocation = $derived(locations.find((l) => l.id === selectedLocationId) ?? null);

	const badgeProps = $derived(
		variantBadgeProps[
			deriveVariant(
				statusMap[selectedLocationId!]?.visited ?? false,
				statusMap[selectedLocationId!]?.contact_made ?? false
			)
		]
	);

	function variantFor(loc: MapLocation): Variant {
		const status = statusMap[loc.id];
		return deriveVariant(status?.visited ?? false, status?.contact_made ?? false);
	}

	/** Set while placing a new business; holds the dropped pin. */
	let draft = $state<{ latitude: number; longitude: number } | null>(null);
	let placing = $state(false);
	let editing = $state<TurfLocation | null>(null);
	let withdrawing = $state<TurfLocation | null>(null);
	let withdrawError = $state<string | null>(null);
	let withdrawBusy = $state(false);

	function startPlacing() {
		placing = true;
		draft = null;
		editing = null;
		selectedLocationId = null;
	}

	function cancelPlacing() {
		placing = false;
		draft = null;
	}

	async function handleSuggest(fields: LocationFields) {
		await onSuggest?.(fields);
		cancelPlacing();
	}

	async function handleEdit(fields: LocationFields) {
		const target = editing;
		if (!target?.entity_id) return;
		await onEditSuggestion?.(target.entity_id, fields);
		editing = null;
	}

	/** Set while proposing a correction to an existing door. */
	let correcting = $state<TurfLocation | null>(null);
	let correctionNote = $state('');
	/** Where the canvasser has moved the pin, if they moved it at all. */
	let correctionPin = $state<{ latitude: number; longitude: number } | null>(null);

	function startCorrection(location: TurfLocation) {
		correcting = location;
		correctionNote = '';
		correctionPin = null;
		placing = false;
		editing = null;
	}

	function cancelCorrection() {
		correcting = null;
		correctionNote = '';
		correctionPin = null;
	}

	async function handleCorrection(fields: LocationFields) {
		const target = correcting;
		if (!target) return;

		// Send only what actually differs, so an organizer reviewing this sees
		// the correction rather than a copy of the whole record.
		const proposal: LocationEditProposal = { photo_keys: fields.photo_keys };
		if (fields.name !== target.location_name) proposal.name = fields.name;
		if (fields.address_line_1 !== target.street) proposal.address_line_1 = fields.address_line_1;
		if (fields.address_line_2 !== (target.street_2 ?? null))
			proposal.address_line_2 = fields.address_line_2;
		if (fields.city !== target.locality) proposal.city = fields.city;
		if (fields.state_or_region !== target.region) proposal.state_or_region = fields.state_or_region;
		if (fields.postal_code !== target.postcode) proposal.postal_code = fields.postal_code;
		if (fields.country_code !== target.country) proposal.country_code = fields.country_code;
		if (correctionPin) {
			proposal.latitude = correctionPin.latitude;
			proposal.longitude = correctionPin.longitude;
		}
		if (correctionNote.trim()) proposal.note = correctionNote.trim();

		await onProposeEdit?.(target.id, proposal);
		cancelCorrection();
	}

	async function confirmWithdraw() {
		const target = withdrawing;
		if (!target?.entity_id) return;
		withdrawBusy = true;
		withdrawError = null;
		try {
			await onDeleteSuggestion?.(target.entity_id);
			withdrawing = null;
			selectedLocationId = null;
		} catch (e) {
			withdrawError = e instanceof Error ? e.message : 'Could not remove this location.';
		} finally {
			withdrawBusy = false;
		}
	}

	function stopTracking() {
		if (watchId !== null) {
			navigator.geolocation.clearWatch(watchId);
			watchId = null;
		}
		geolocateState = 'idle';
		userPosition = null;
	}

	function toggleGeolocate() {
		if (geolocateState === 'tracking' || geolocateState === 'locating') {
			stopTracking();
			return;
		}
		if (!navigator.geolocation) {
			geolocateState = 'error';
			return;
		}
		geolocateState = 'locating';
		let recentred = false;
		watchId = navigator.geolocation.watchPosition(
			(position) => {
				geolocateState = 'tracking';
				userPosition = {
					latitude: position.coords.latitude,
					longitude: position.coords.longitude
				};
				// Recentre on the first fix only; afterwards the dot moves and the
				// canvasser keeps control of the viewport.
				if (!recentred) {
					recentred = true;
					mapRef?.panTo(userPosition);
				}
			},
			() => {
				geolocateState = 'error';
				watchId = null;
			},
			{ enableHighAccuracy: true }
		);
	}

	async function pollStatuses() {
		const res = await fetch(`/o/${orgSlug}/map/${turfId}/status`);
		if (!res.ok) return;
		const updates: Array<{ id: string; visited: boolean; contact_made: boolean | null }> =
			await res.json();
		for (const update of updates) {
			statusMap[update.id] = { visited: update.visited, contact_made: update.contact_made };
		}
	}

	onMount(() => {
		let pollInterval: ReturnType<typeof setInterval> | null = null;

		function startPolling() {
			if (pollInterval !== null) return;
			pollInterval = setInterval(pollStatuses, 15_000);
		}

		function stopPolling() {
			if (pollInterval === null) return;
			clearInterval(pollInterval);
			pollInterval = null;
		}

		function handleVisibilityChange() {
			if (document.visibilityState === 'hidden') {
				stopPolling();
			} else {
				pollStatuses();
				startPolling();
			}
		}

		document.addEventListener('visibilitychange', handleVisibilityChange);
		startPolling();

		return () => {
			stopPolling();
			document.removeEventListener('visibilitychange', handleVisibilityChange);
			stopTracking();
		};
	});
</script>

<a
	href="/o/{orgSlug}"
	class="fixed top-4 left-4 z-20 size-10 rounded-full bg-surface text-on-surface inline-flex items-center justify-center shadow"
	aria-label="Back to home"
>
	<ArrowLeftIcon size={20} weight="bold" />
</a>

<button
	onclick={toggleGeolocate}
	aria-label={geolocateState === 'tracking' ? 'Stop tracking location' : 'Find my location'}
	class={[
		'fixed top-[68px] right-4 z-20 size-10 rounded-full inline-flex items-center justify-center shadow transition-colors',
		geolocateState === 'tracking'
			? 'bg-success-container text-on-success-container'
			: geolocateState === 'error'
				? 'bg-error-container text-on-error-container'
				: 'bg-surface text-on-surface'
	].join(' ')}
>
	<GpsIcon size={20} weight={geolocateState === 'tracking' ? 'fill' : 'bold'} />
</button>

{#if canSuggest && !placing && !draft && !editing}
	<div class="fixed bottom-3 left-3 right-3 z-20 flex justify-center">
		<Button variant="primary" onclick={startPlacing} class="shadow-lg">
			<StorefrontIcon />
			Business not listed
		</Button>
	</div>
{/if}

{#if placing && !draft}
	<div
		class="fixed top-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full bg-surface px-4 py-2 shadow-lg"
	>
		<p class="text-sm text-on-surface">Tap the map on the business</p>
		<button class="text-sm font-semibold text-primary" onclick={cancelPlacing}>Cancel</button>
	</div>
{/if}

<LocationsMap
	bind:this={mapRef}
	bind:selectedLocationId
	locations={mapLocations}
	{variantFor}
	popup={null}
	boundsGeoJSON={bounds}
	pinDropMode={placing}
	onPinDrop={(coords) => (draft = coords)}
	draftPin={correctionPin ?? draft}
	onDraftMove={(coords) => (correcting ? (correctionPin = coords) : (draft = coords))}
	{userPosition}
	autoFit={!placing && !correcting}
	defaultCenter={[center.lng, center.lat]}
	defaultZoom={15}
	class="w-screen h-screen"
/>

{#if draft || editing}
	<div
		class="fixed inset-x-0 bottom-0 z-30 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-surface p-4 shadow-lg"
	>
		<h2 class="mb-4 text-base font-semibold">
			{editing ? 'Edit your addition' : 'Add this business'}
		</h2>
		{#if editing}
			{#key editing.id}
				<LocationForm
					initialValues={{
						name: editing.location_name,
						address_line_1: editing.street,
						city: editing.locality,
						state_or_region: editing.region,
						postal_code: editing.postcode,
						country_code: editing.country
					}}
					coordinates={{ latitude: editing.latitude, longitude: editing.longitude }}
					{orgSlug}
					submitLabel="Save changes"
					onSubmit={handleEdit}
					onCancel={() => (editing = null)}
				/>
			{/key}
		{:else if draft}
			<LocationForm
				coordinates={draft}
				{orgSlug}
				submitLabel="Add business"
				instructions="Photograph the business name and address so an organizer can check the details."
				onSubmit={handleSuggest}
				onCancel={cancelPlacing}
			/>
		{/if}
	</div>
{/if}

<ConfirmDialog
	open={withdrawing !== null}
	title="Remove this business?"
	description="It will be taken off your turf along with anything you recorded against it."
	confirmLabel="Remove"
	destructive
	loading={withdrawBusy}
	error={withdrawError}
	onConfirm={confirmWithdraw}
	onCancel={() => (withdrawing = null)}
/>

<!-- Fixed rather than layered inside the map, matching the back and locate
     controls above, so the sheet never competes with the map canvas for hits. -->
{#if correcting}
	<div
		class="fixed inset-x-0 bottom-0 z-30 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-surface p-4 shadow-lg"
	>
		<h2 class="mb-1 text-base font-semibold">Correct these details</h2>
		<p class="mb-4 text-sm text-on-surface-variant">
			Change only what is wrong, and photograph the business name and address so an organizer can
			check it. An organizer approves the change before it reaches the dataset.
		</p>

		{#key correcting.id}
			<LocationForm
				initialValues={{
					name: correcting.location_name,
					address_line_1: correcting.street,
					address_line_2: correcting.street_2 ?? null,
					city: correcting.locality,
					state_or_region: correcting.region,
					postal_code: correcting.postcode,
					country_code: correcting.country
				}}
				coordinates={correctionPin ?? {
					latitude: correcting.latitude,
					longitude: correcting.longitude
				}}
				{orgSlug}
				submitLabel="Send correction"
				onSubmit={handleCorrection}
				onCancel={cancelCorrection}
			>
				<label class="flex flex-col gap-1.5">
					<span class="text-sm font-medium text-on-surface">What is wrong?</span>
					<textarea
						bind:value={correctionNote}
						rows="3"
						class="rounded-md border border-outline bg-surface px-3 py-2 text-sm text-on-surface"
					></textarea>
				</label>

				{#if correctionPin}
					<p class="text-xs text-on-surface-subtle">Pin moved. Drag it again to adjust.</p>
				{:else}
					<button
						type="button"
						class="self-start text-sm font-semibold text-primary"
						onclick={() =>
							(correctionPin = {
								latitude: correcting!.latitude,
								longitude: correcting!.longitude
							})}
					>
						The pin is in the wrong place
					</button>
				{/if}
			</LocationForm>
		{/key}
	</div>
{/if}

{#if selectedLocation && !draft && !editing && !correcting}
	<div
		class="flex flex-col gap-5 rounded-xl fixed bottom-3 left-3 right-3 bg-surface p-4 shadow-lg z-20"
	>
		<Button
			variant="ghost"
			iconOnly
			aria-label="close"
			class="absolute top-1 right-1"
			onclick={() => (selectedLocationId = null)}
		>
			<XIcon />
		</Button>
		<div class="flex flex-wrap items-center gap-2 self-start">
			<Badge variant={badgeProps.variant} size="sm">{badgeProps.label}</Badge>
			{#if selectedLocation.is_tentative}
				<Badge variant="warning" size="sm">Awaiting review</Badge>
			{/if}
		</div>
		<div class="space-y-1 mb-6">
			<h3 class="text-lg font-semibold">{selectedLocation.location_name}</h3>
			{#if selectedLocation.street}
				<p class="text-on-surface-variant text-sm">{selectedLocation.street}</p>
			{/if}
		</div>

		<Button
			href="/o/{orgSlug}/map/{turfId}/location/{selectedLocation.id}"
			variant="primary"
			class="w-full"
		>
			Open Location
		</Button>

		<!-- Anyone canvassing may report that a door's record is wrong; only the
		     author of a still-unreviewed addition can change it outright. -->
		{#if canSuggest && !selectedLocation.is_mine}
			{#if selectedLocation.has_pending_edit}
				<p class="text-center text-sm text-on-surface-subtle">
					Your correction is waiting to be reviewed.
				</p>
			{:else}
				<Button variant="outline" class="w-full" onclick={() => startCorrection(selectedLocation!)}>
					<PencilLineIcon />
					Details are wrong
				</Button>
			{/if}
		{/if}

		{#if selectedLocation.is_mine && canSuggest}
			<div class="flex gap-2">
				<Button
					variant="outline"
					class="flex-1"
					onclick={() => {
						editing = selectedLocation;
						placing = false;
					}}
				>
					<PencilSimpleIcon />
					Edit
				</Button>
				<Button
					variant="ghost"
					class="flex-1"
					onclick={() => {
						withdrawing = selectedLocation;
						withdrawError = null;
					}}
				>
					<TrashIcon />
					Remove
				</Button>
			</div>
		{/if}
	</div>
{/if}
