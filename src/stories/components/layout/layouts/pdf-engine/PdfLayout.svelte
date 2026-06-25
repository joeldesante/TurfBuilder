<script lang="ts">
	import type { Snippet } from 'svelte';
	import PdfPage from './pdf-page/PdfPage.svelte';
	import RadioGroup from '$components/data-inputs/radio-group/RadioGroup.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import FormField from '$components/data-inputs/form-field/FormField.svelte';
	import TextInput from '$components/data-inputs/text-input/TextInput.svelte';
	import Checkbox from '$components/data-inputs/checkbox/Checkbox.svelte';
	import { MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon, SlidersIcon, XIcon } from 'phosphor-svelte';

	interface Props {
		pages: Snippet[];
	}

	const { pages }: Props = $props();

	let pageType = $state<'Letter' | 'A4'>('Letter');
	let zoom = $state(80);

	type MarginUnit = 'in' | 'cm';
	let marginUnit = $state<MarginUnit>('in');
	let marginValues = $state({ top: 1, bottom: 1, left: 1, right: 1 });
	let showMarginGuides = $state(false);
	let sidebarOpen = $state(false);
	let pageRefs: HTMLElement[] = $state([]);

	function injectPageStyle(): HTMLStyleElement {
		const [w, h] = pageType === 'Letter' ? ['8.5in', '11in'] : ['210mm', '297mm'];
		const style = document.createElement('style');
		style.dataset.pdfEngine = 'true';
		style.textContent = `@page { size: ${w} ${h}; margin: 0; } @media print { body { margin: 0 !important; padding: 0 !important; } }`;
		document.head.appendChild(style);
		return style;
	}

	function handlePrint() {
		const style = injectPageStyle();
		window.print();
		style.remove();
	}


	const marginUnitItems = [
		{ value: 'in', label: 'in' },
		{ value: 'cm', label: 'cm' }
	];

	const margins = $derived({
		top: `${marginValues.top}${marginUnit}`,
		bottom: `${marginValues.bottom}${marginUnit}`,
		left: `${marginValues.left}${marginUnit}`,
		right: `${marginValues.right}${marginUnit}`
	});

	function clampMarginValue(value: number): number {
		return Math.max(0, isNaN(value) ? 0 : value);
	}

	const ZOOM_STEP = 10;
	const ZOOM_MIN = 25;
	const ZOOM_MAX = 200;

	function zoomIn() {
		zoom = Math.min(zoom + ZOOM_STEP, ZOOM_MAX);
	}
	function zoomOut() {
		zoom = Math.max(zoom - ZOOM_STEP, ZOOM_MIN);
	}

	const paperTypeItems = [
		{ value: 'Letter', label: 'Letter (8.5 × 11 in)' },
		{ value: 'A4', label: 'A4 (210 × 297 mm)' }
	];
</script>

<div class="pdf-layout-root flex h-screen w-screen overflow-hidden">
	<!-- Workarea -->
	<div class="flex flex-1 flex-col overflow-hidden bg-gray-100">
		<!-- Toolbar -->
		<div class="pdf-layout-toolbar flex items-center justify-between gap-2 border-b border-gray-200 bg-white px-4 py-2">
			<div class="flex items-center gap-2">
				<Button variant="ghost" size="sm" iconOnly aria-label="Zoom out" onclick={zoomOut} disabled={zoom <= ZOOM_MIN}>
					{#snippet children()}<MagnifyingGlassMinusIcon />{/snippet}
				</Button>
				<span class="w-14 text-center text-sm tabular-nums text-gray-600">{zoom}%</span>
				<Button variant="ghost" size="sm" iconOnly aria-label="Zoom in" onclick={zoomIn} disabled={zoom >= ZOOM_MAX}>
					{#snippet children()}<MagnifyingGlassPlusIcon />{/snippet}
				</Button>
			</div>
			<Button variant="ghost" size="sm" iconOnly aria-label="Settings" onclick={() => (sidebarOpen = true)} class="lg:hidden">
				{#snippet children()}<SlidersIcon />{/snippet}
			</Button>
		</div>

		<!-- Pages -->
		<div class="pdf-layout-workarea flex flex-1 items-start justify-center overflow-auto p-4 md:p-8">
			<div class="pdf-layout-pages flex flex-col gap-8" style:zoom={zoom / 100}>
				{#each pages as page, i (i)}
					<div class="pdf-layout-page shadow-xl" bind:this={pageRefs[i]}>
						<PdfPage type={pageType} {margins} {showMarginGuides}>
							{@render page()}
						</PdfPage>
					</div>
				{/each}
			</div>
		</div>
	</div>

	<!-- Mobile overlay backdrop -->
	{#if sidebarOpen}
		<div
			class="pdf-layout-backdrop fixed inset-0 z-20 bg-black/40 lg:hidden"
			role="presentation"
			onclick={() => (sidebarOpen = false)}
		></div>
	{/if}

	<!-- Sidebar -->
	<div class={[
		'pdf-layout-sidebar flex w-72 shrink-0 flex-col border-l border-gray-200 bg-white overflow-y-auto',
		'fixed inset-y-0 right-0 z-30 transition-transform duration-200 lg:static lg:translate-x-0 lg:z-auto',
		sidebarOpen ? 'translate-x-0' : 'translate-x-full'
	].join(' ')}>
		<div class="flex items-center justify-between border-b border-gray-200 px-4 py-3 lg:hidden">
			<span class="text-sm font-semibold text-gray-700">Settings</span>
			<Button variant="ghost" size="sm" iconOnly aria-label="Close settings" onclick={() => (sidebarOpen = false)}>
				{#snippet children()}<XIcon />{/snippet}
			</Button>
		</div>

		<section>
			<h2 class="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Paper Type</h2>
			<div class="px-4 pb-4">
				<RadioGroup
					label=""
					items={paperTypeItems}
					bind:value={pageType}
					onValueChange={(v) => (pageType = v as 'Letter' | 'A4')}
				/>
			</div>
		</section>

		<div class="border-t border-gray-200"></div>

		<section>
			<div class="flex items-center justify-between px-4 py-3">
				<h2 class="text-xs font-semibold uppercase tracking-wide text-gray-500">Margins</h2>
				<Checkbox bind:checked={showMarginGuides}>
					{#snippet children()}Show guides{/snippet}
				</Checkbox>
			</div>
			<div class="grid grid-cols-2 gap-3 px-4 pb-4">
				{#each ['top', 'bottom', 'left', 'right'] as side}
					<FormField label={side.charAt(0).toUpperCase() + side.slice(1)}>
						{#snippet children()}
							<TextInput
								type="number"
								min="0"
								value={String(marginValues[side as keyof typeof marginValues])}
								onblur={(e: FocusEvent) => {
									marginValues[side as keyof typeof marginValues] = clampMarginValue(
										parseFloat((e.target as HTMLInputElement).value)
									);
								}}
							/>
						{/snippet}
					</FormField>
				{/each}
			</div>
			<div class="px-4 pb-4">
				<RadioGroup
					label=""
					items={marginUnitItems}
					bind:value={marginUnit}
					onValueChange={(v) => (marginUnit = v as MarginUnit)}
					orientation="horizontal"
				/>
			</div>
		</section>

		<div class="mt-auto border-t border-gray-200 p-4 print:hidden">
			<Button variant="primary" onclick={handlePrint}>
				{#snippet children()}Save / Print{/snippet}
			</Button>
		</div>
	</div>
</div>

<style>
	@media print {
		:global(.pdf-layout-toolbar),
		:global(.pdf-layout-sidebar),
		:global(.pdf-layout-backdrop) {
			display: none !important;
		}

		:global(.pdf-layout-root) {
			display: block !important;
			height: auto !important;
			width: auto !important;
			overflow: visible !important;
		}

		:global(.pdf-layout-workarea) {
			display: block !important;
			height: auto !important;
			overflow: visible !important;
			background: none !important;
			padding: 0 !important;
		}

		:global(.pdf-layout-pages) {
			display: block !important;
			zoom: 1 !important;
			margin: 0 !important;
			padding: 0 !important;
		}

		:global(.pdf-layout-page) {
			box-shadow: none !important;
			margin: 0 !important;
			padding: 0 !important;
			page-break-after: always;
			break-after: page;
		}

		:global(.pdf-layout-page:last-child) {
			page-break-after: auto;
			break-after: auto;
		}

		:global(.pdf-page) {
			overflow: visible !important;
		}
	}
</style>
