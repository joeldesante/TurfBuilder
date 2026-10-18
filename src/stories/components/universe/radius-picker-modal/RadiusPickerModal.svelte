<script lang="ts">
	import { Dialog } from 'bits-ui';
	import Button from '$components/actions/button/Button.svelte';
	import LocationsMap from '$components/data-display/locations-map/LocationsMap.svelte';
	import TextInput from '$components/data-inputs/text-input/TextInput.svelte';
	import XIcon from 'phosphor-svelte/lib/X';
	import type { RadiusValue } from '$lib/shared/types/filters';
	import { circlePolygon, distanceMiles } from '$lib/shared/utils/geo';

	interface Props {
		open: boolean;
		/** The area already chosen, if any. */
		value?: RadiusValue | null;
		onOpenChange: (open: boolean) => void;
		onapply: (value: RadiusValue) => void;
	}

	const { open, value = null, onOpenChange, onapply }: Props = $props();

	const DEFAULT_RADIUS = 1;

	let point = $state<{ latitude: number; longitude: number } | null>(null);
	let radiusInput = $state(String(DEFAULT_RADIUS));

	// Start from the saved value each time the modal opens, so cancelling discards edits.
	$effect(() => {
		if (!open) return;
		point = value ? { latitude: value.latitude, longitude: value.longitude } : null;
		radiusInput = String(value?.radius ?? DEFAULT_RADIUS);
	});

	const radius = $derived(Number(radiusInput));
	const valid = $derived(point !== null && Number.isFinite(radius) && radius > 0);
	const circle = $derived(point && valid ? circlePolygon(point, radius) : null);

	// The grip sits on the circle's east edge: same latitude, a radius away in longitude.
	const handle = $derived.by(() => {
		if (!point || !valid) return null;
		const [longitude] = circlePolygon(point, radius, 4).coordinates[0][1];
		return { latitude: point.latitude, longitude };
	});

	function resize(coords: { latitude: number; longitude: number }) {
		if (!point) return;
		// Round so the input does not fill with float noise while dragging.
		const miles = Math.max(0.01, Math.round(distanceMiles(point, coords) * 100) / 100);
		radiusInput = String(miles);
	}

	function apply() {
		if (!point || !valid) return;
		onapply({ ...point, radius });
	}
</script>

<Dialog.Root {open} {onOpenChange}>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-50 bg-black/40" />
		<!-- preventOverflowTextSelection off: bits-ui would otherwise set user-select: text on the dialog while the mouse is down, overriding select-none. -->
		<Dialog.Content
			preventOverflowTextSelection={false}
			class="fixed left-1/2 top-1/2 z-50 flex h-[36rem] w-[calc(100vw-2rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-surface shadow-lg select-none [&_input]:select-text [&_textarea]:select-text"
		>
			<div class="flex items-center justify-between border-b border-outline px-6 py-4">
				<div>
					<Dialog.Title class="text-lg font-semibold text-on-surface">Radius From Point</Dialog.Title>
					<Dialog.Description class="text-sm text-on-surface-subtle">
						Click the map to choose a point, then drag the handle on the circle or type a radius.
					</Dialog.Description>
				</div>
				<Dialog.Close>
					{#snippet child({ props })}
						<Button {...props} variant="ghost" size="sm" iconOnly aria-label="Close">
							<XIcon />
						</Button>
					{/snippet}
				</Dialog.Close>
			</div>

			<div class="min-h-0 flex-1">
				<LocationsMap
					class="h-full w-full"
					pinDropMode
					autoFit={false}
					draftPin={point}
					boundsGeoJSON={circle}
					{handle}
					onHandleDrag={resize}
					onPinDrop={(coords) => (point = coords)}
					onDraftMove={(coords) => (point = coords)}
				/>
			</div>

			<div class="flex items-center justify-between gap-4 border-t border-outline px-6 py-4">
				<label class="flex items-center gap-2 text-sm text-on-surface">
					Radius
					<TextInput
						type="number"
						class="w-28"
						aria-label="Radius in miles"
						bind:value={radiusInput}
					/>
					miles
				</label>
				<div class="flex gap-2">
					<Button variant="ghost" onclick={() => onOpenChange(false)}>Cancel</Button>
					<Button disabled={!valid} onclick={apply}>Apply</Button>
				</div>
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
