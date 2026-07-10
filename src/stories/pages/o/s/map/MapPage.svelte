<script lang="ts">
	import Button from '$components/actions/button/Button.svelte';
	import LayeredMap, {
		type MapLayer
	} from '$components/data-display/layered-map/LayeredMap.svelte';
	import Spinner from '$components/feedback/spinner/Spinner.svelte';
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';
	import PlusIcon from 'phosphor-svelte/lib/Plus';
	import StackIcon from 'phosphor-svelte/lib/Stack';

	interface Props {
		layers: Promise<MapLayer[]> | MapLayer[];
		browseHref?: string;
		createHref?: string;
	}

	const { layers, browseHref = 'map/browse', createHref = 'map/create' }: Props = $props();
</script>

<div class="flex h-full flex-col">
	<PageHeader
		title="Map"
		subheading="View your organization's map layers and select areas to work with."
	>
		{#snippet actions()}
			<!-- Hiding this for now until we are ready to store private layers or layer remixes.
			<Button variant="outline" href={createHref}>
				<PlusIcon />
				Create Custom Layer
			</Button>
			-->
			<Button href={browseHref}>
				<StackIcon />
				Browse Layer Library
			</Button>
		{/snippet}
	</PageHeader>

	<div class="border-outline min-h-0 flex-1 overflow-hidden rounded-lg border">
		{#await layers}
			<div class="flex h-full w-full items-center justify-center gap-2" role="status">
				<Spinner />
				<span class="text-on-surface-subtle text-sm">Loading map layers...</span>
			</div>
		{:then resolvedLayers}
			<LayeredMap layers={resolvedLayers} />
		{:catch error}
			<div class="flex h-full w-full items-center justify-center">
				<p class="text-error text-sm" role="alert">
					{error instanceof Error ? error.message : 'Failed to load map layers.'}
				</p>
			</div>
		{/await}
	</div>
</div>
