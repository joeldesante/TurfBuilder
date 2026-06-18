<script lang="ts">
	import { mount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import PageHeader from '$components/layout/page-header/PageHeader.svelte';
	import Badge from '$components/data-display/badge/Badge.svelte';
	import MapMarker, { type Variant } from '$components/data-display/map-marker/MapMarker.svelte';
	import MapPopup from '$components/data-display/map-popup/MapPopup.svelte';
	import ArrowLeftIcon from 'phosphor-svelte/lib/ArrowLeft';
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDown';
	import CopyButton from '$components/actions/copy-button/CopyButton.svelte';
	import 'maplibre-gl/dist/maplibre-gl.css';

	interface TurfData {
		id: string;
		code: string;
		expires_at: string;
		created_at: string;
		author: string;
		survey_name: string | null;
		bounds: string | null;
		list_name: string;
		bucket_name: string;
	}

	interface LocationData {
		turf_location_id: string;
		name: string | null;
		address_line_1: string | null;
		city: string | null;
		state_or_region: string | null;
		latitude: number | null;
		longitude: number | null;
		attempt_id: string | null;
		contact_made: boolean | null;
		attempt_note: string | null;
		attempted_at: string | null;
	}

	interface ResponseData {
		attempt_id: string;
		turf_location_id: string;
		question_id: string;
		question_text: string;
		question_type: string;
		order_index: number;
		response_value: string;
	}

	interface Props {
		turf: TurfData;
		listHref: string;
		locations: LocationData[];
		responses: ResponseData[];
	}

	const { turf, listHref, locations, responses }: Props = $props();

	// Group responses by turf_location_id for easy lookup.
	const responsesByLocation = $derived(
		responses.reduce<Record<string, ResponseData[]>>((acc, r) => {
			if (!acc[r.turf_location_id]) acc[r.turf_location_id] = [];
			acc[r.turf_location_id].push(r);
			return acc;
		}, {})
	);

	const totalCount = $derived(locations.length);
	const attemptedCount = $derived(locations.filter((l) => l.attempt_id !== null).length);
	const contactedCount = $derived(locations.filter((l) => l.contact_made === true).length);
	const noContactCount = $derived(locations.filter((l) => l.contact_made === false).length);
	const pctComplete = $derived(
		totalCount > 0 ? Math.round((attemptedCount / totalCount) * 100) : 0
	);

	let expandedIds = $state<Set<string>>(new Set());

	function toggleExpanded(id: string) {
		const next = new Set(expandedIds);
		if (next.has(id)) {
			next.delete(id);
		} else {
			next.add(id);
		}
		expandedIds = next;
	}

	function locationVariant(contactMade: boolean | null): Variant {
		if (contactMade === true) return 'contacted';
		if (contactMade === false) return 'no-contact';
		return 'unvisited';
	}

	function locationLabel(loc: LocationData): string {
		return loc.name ?? loc.address_line_1 ?? 'Unknown';
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function isExpired(dateStr: string): boolean {
		return new Date(dateStr) < new Date();
	}

	// Map setup
	let mapContainer: HTMLDivElement | undefined = $state();
	let mapInstance: import('maplibre-gl').Map | undefined;

	function computeBounds(boundsJson: string | null, locs: LocationData[]) {
		const maplibregl = (window as any).__maplibregl_instance as typeof import('maplibre-gl');

		if (boundsJson) {
			try {
				const geometry = JSON.parse(boundsJson);
				const coords: [number, number][] =
					geometry.type === 'MultiPolygon'
						? geometry.coordinates.flatMap((poly: [number, number][][]) => poly[0])
						: geometry.coordinates[0];
				if (coords.length > 0) {
					return coords.reduce(
						(b, c) => b.extend(c),
						new maplibregl.LngLatBounds(coords[0], coords[0])
					);
				}
			} catch {
				// fall through
			}
		}

		const withCoords = locs.filter((l) => l.latitude !== null && l.longitude !== null);
		if (withCoords.length > 0) {
			return withCoords.reduce(
				(b, l) => b.extend([l.longitude!, l.latitude!] as [number, number]),
				new maplibregl.LngLatBounds(
					[withCoords[0].longitude!, withCoords[0].latitude!],
					[withCoords[0].longitude!, withCoords[0].latitude!]
				)
			);
		}
		return null;
	}

	$effect(() => {
		if (!browser || !mapContainer) return;

		let destroyed = false;

		(async () => {
			const maplibregl = await import('maplibre-gl');
			(window as any).__maplibregl_instance = maplibregl;
			const { getMapStyle } = await import('$lib/map-style');

			if (destroyed) return;

			const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
			const style = await getMapStyle(isDark);
			const bounds = computeBounds(turf.bounds, locations);

			if (destroyed) return;

			mapInstance = new maplibregl.Map({
				container: mapContainer!,
				// @ts-ignore
				style,
				...(bounds
					? { bounds, fitBoundsOptions: { padding: 60, maxZoom: 16 } }
					: { center: [0, 0] as [number, number], zoom: 4 })
			});

			mapInstance.on('load', () => {
				if (!mapInstance || destroyed) return;

				// Turf polygon
				if (turf.bounds) {
					try {
						const geometry = JSON.parse(turf.bounds);
						mapInstance.addSource('turf-bounds', {
							type: 'geojson',
							data: { type: 'Feature', geometry, properties: {} }
						});
						mapInstance.addLayer({
							id: 'turf-fill',
							type: 'fill',
							source: 'turf-bounds',
							paint: { 'fill-color': '#10b981', 'fill-opacity': 0.18 }
						});
						mapInstance.addLayer({
							id: 'turf-outline',
							type: 'line',
							source: 'turf-bounds',
							paint: { 'line-color': '#10b981', 'line-width': 2.5, 'line-opacity': 0.9 }
						});
					} catch {
						// malformed geometry
					}
				}

				// Location markers
				for (const loc of locations) {
					if (loc.latitude === null || loc.longitude === null) continue;

					const element = document.createElement('div');
					mount(MapMarker, {
						target: element,
						props: {
							variant: locationVariant(loc.contact_made),
							get isSelected() { return expandedIds.has(loc.turf_location_id); }
						}
					});

					element.addEventListener('click', () => toggleExpanded(loc.turf_location_id));

					const popupEl = document.createElement('div');
					mount(MapPopup, {
						target: popupEl,
						props: {
							locationName: loc.name ?? loc.address_line_1 ?? '',
							street: loc.address_line_1,
							locality: loc.city
						}
					});

					new maplibregl.Marker({ element, anchor: 'bottom' })
						.setLngLat([loc.longitude, loc.latitude])
						.setPopup(new maplibregl.Popup({ offset: 34 }).setDOMContent(popupEl))
						.addTo(mapInstance!);
				}
			});
		})();

		return () => {
			destroyed = true;
			mapInstance?.remove();
			mapInstance = undefined;
		};
	});

	onDestroy(() => {
		mapInstance?.remove();
	});
</script>

<div class="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-6">
	<a
		href={listHref}
		class="inline-flex items-center gap-1 text-sm text-on-surface-subtle hover:text-on-surface transition-colors"
	>
		<ArrowLeftIcon size={14} />
		Back to {turf.list_name}
	</a>

	<PageHeader title={turf.code} subheading={turf.survey_name ?? turf.bucket_name} class="pt-0">
		{#snippet actions()}
			<CopyButton value={turf.code} aria-label="Copy turf code" />
			<Badge
				variant={isExpired(turf.expires_at) ? 'error' : 'success'}
				size="sm"
			>
				{isExpired(turf.expires_at) ? 'Expired' : 'Active'}
			</Badge>
		{/snippet}
	</PageHeader>

	<!-- Metadata strip -->
	<div class="flex flex-wrap gap-x-6 gap-y-2 text-sm text-on-surface-subtle">
		<span>Cut by <span class="text-on-surface font-medium">{turf.author}</span></span>
		<span>Created <span class="text-on-surface">{formatDate(turf.created_at)}</span></span>
		<span class={isExpired(turf.expires_at) ? 'text-error' : ''}>
			{isExpired(turf.expires_at) ? 'Expired' : 'Expires'}
			{formatDate(turf.expires_at)}
		</span>
	</div>

	<!-- Stats -->
	<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
		<div class="rounded-xl border border-outline-subtle px-4 py-3 flex flex-col gap-0.5">
			<span class="text-2xl font-semibold text-on-surface">{totalCount}</span>
			<span class="text-xs text-on-surface-subtle">Total Locations</span>
		</div>
		<div class="rounded-xl border border-outline-subtle px-4 py-3 flex flex-col gap-0.5">
			<span class="text-2xl font-semibold text-on-surface">{pctComplete}%</span>
			<span class="text-xs text-on-surface-subtle">Attempted</span>
		</div>
		<div class="rounded-xl border border-outline-subtle px-4 py-3 flex flex-col gap-0.5">
			<span class="text-2xl font-semibold text-location-contacted">{contactedCount}</span>
			<span class="text-xs text-on-surface-subtle">Contacted</span>
		</div>
		<div class="rounded-xl border border-outline-subtle px-4 py-3 flex flex-col gap-0.5">
			<span class="text-2xl font-semibold text-location-no-contact">{noContactCount}</span>
			<span class="text-xs text-on-surface-subtle">No Contact</span>
		</div>
	</div>

	<!-- Map -->
	<div class="rounded-xl border border-outline-subtle overflow-hidden" style="height: 360px;">
		<div bind:this={mapContainer} class="w-full h-full"></div>
	</div>

	<!-- Location responses -->
	<section class="flex flex-col gap-2">
		<h2 class="text-base font-semibold text-on-surface">Locations</h2>

		{#if locations.length === 0}
			<p class="text-sm text-on-surface-subtle py-4 text-center">No locations in this turf.</p>
		{:else}
			<div class="flex flex-col gap-1">
				{#each locations as loc (loc.turf_location_id)}
					{@const isOpen = expandedIds.has(loc.turf_location_id)}
					{@const locResponses = responsesByLocation[loc.turf_location_id] ?? []}
					{@const variant = locationVariant(loc.contact_made)}

					<div class="rounded-xl border border-outline-subtle overflow-hidden">
						<!-- Row header -->
						<button
							class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-container transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
							onclick={() => toggleExpanded(loc.turf_location_id)}
							aria-expanded={isOpen}
						>
							<div class="shrink-0">
								{#if variant === 'contacted'}
									<Badge variant="location-contacted" size="sm">Contacted</Badge>
								{:else if variant === 'no-contact'}
									<Badge variant="location-no-contact" size="sm">No Contact</Badge>
								{:else}
									<Badge variant="location-unvisited" size="sm">Unvisited</Badge>
								{/if}
							</div>

							<div class="flex-1 min-w-0">
								<p class="text-sm font-medium text-on-surface truncate">{locationLabel(loc)}</p>
								{#if loc.address_line_1 && loc.name}
									<p class="text-xs text-on-surface-subtle truncate">{loc.address_line_1}</p>
								{/if}
								{#if loc.city}
									<p class="text-xs text-on-surface-subtle">
										{loc.city}{loc.state_or_region ? `, ${loc.state_or_region}` : ''}
									</p>
								{/if}
							</div>

							{#if loc.attempt_id !== null}
								<span class="text-xs text-on-surface-subtle shrink-0 hidden sm:block">
									{formatDate(loc.attempted_at!)}
								</span>
							{/if}

							<CaretDownIcon
								class="size-4 text-on-surface-subtle shrink-0 transition-transform duration-200 {isOpen ? 'rotate-180' : ''}"
							/>
						</button>

						<!-- Expanded detail -->
						{#if isOpen}
							<div class="border-t border-outline-subtle px-4 py-4 flex flex-col gap-4 bg-surface-container/40">
								{#if loc.attempt_id === null}
									<p class="text-sm text-on-surface-subtle italic">No attempt recorded for this location.</p>
								{:else}
									{#if loc.attempt_note}
										<div class="flex flex-col gap-1">
											<span class="text-xs font-medium text-on-surface-subtle uppercase tracking-wide">Note</span>
											<p class="text-sm text-on-surface leading-relaxed">{loc.attempt_note}</p>
										</div>
									{/if}

									{#if locResponses.length > 0}
										<div class="flex flex-col gap-3">
											<span class="text-xs font-medium text-on-surface-subtle uppercase tracking-wide">Survey Responses</span>
											{#each locResponses as response (response.question_id)}
												<div class="flex flex-col gap-1">
													<p class="text-sm font-medium text-on-surface">{response.question_text}</p>
													<p class="text-sm text-on-surface-subtle">
														{#if response.response_value}
															{response.response_value}
														{:else}
															<em class="italic">No answer</em>
														{/if}
													</p>
												</div>
											{/each}
										</div>
									{:else if loc.contact_made}
										<p class="text-sm text-on-surface-subtle italic">No survey responses recorded.</p>
									{/if}
								{/if}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</section>
</div>

<style>
	:global(.maplibregl-popup) {
		font-family: inherit;
	}

	:global(.maplibregl-popup-content) {
		background-color: var(--surface);
		color: var(--on-surface);
		border-radius: 0.75rem;
		box-shadow:
			0 10px 15px -3px rgb(0 0 0 / 0.1),
			0 4px 6px -4px rgb(0 0 0 / 0.1);
		padding: 0.75rem 1rem;
		font-size: 0.875rem;
		border: 1px solid var(--outline-subtle);
	}

	:global(.maplibregl-popup-close-button) {
		color: var(--on-surface-subtle);
		font-size: 0;
		aspect-ratio: 1;
		padding: 0;
		width: 2rem;
		border-radius: 0.375rem;
		margin: 0.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	:global(.maplibregl-popup-close-button::after) {
		content: '';
		display: block;
		width: 0.75rem;
		height: 0.75rem;
		background-color: currentColor;
		mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'%3E%3Cpath d='M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z'/%3E%3C/svg%3E");
		mask-size: contain;
		mask-repeat: no-repeat;
		mask-position: center;
	}

	:global(.maplibregl-popup-close-button:focus:not(:focus-visible)) {
		outline: none;
	}

	:global(.maplibregl-popup-close-button:hover) {
		background-color: var(--surface-container);
		color: var(--on-surface);
	}

	:global(.maplibregl-popup-anchor-bottom .maplibregl-popup-tip) { border-top-color: var(--surface); }
	:global(.maplibregl-popup-anchor-top .maplibregl-popup-tip) { border-bottom-color: var(--surface); }
	:global(.maplibregl-popup-anchor-left .maplibregl-popup-tip) { border-right-color: var(--surface); }
	:global(.maplibregl-popup-anchor-right .maplibregl-popup-tip) { border-left-color: var(--surface); }
	:global(.maplibregl-popup-anchor-bottom-left .maplibregl-popup-tip),
	:global(.maplibregl-popup-anchor-bottom-right .maplibregl-popup-tip) { border-top-color: var(--surface); }
	:global(.maplibregl-popup-anchor-top-left .maplibregl-popup-tip),
	:global(.maplibregl-popup-anchor-top-right .maplibregl-popup-tip) { border-bottom-color: var(--surface); }
</style>
