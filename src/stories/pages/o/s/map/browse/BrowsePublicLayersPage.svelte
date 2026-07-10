<script lang="ts">
	import Button from '$components/actions/button/Button.svelte';
	import TextInput from '$components/data-inputs/text-input/TextInput.svelte';
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';

	export interface PublicLayer {
		id: string;
		label: string;
		description?: string;
	}

	interface Props {
		layers?: PublicLayer[];
		onAdd: (layer: PublicLayer) => Promise<void>;
	}

	const { layers = [], onAdd }: Props = $props();

	let query = $state('');
	let addingId = $state<string | null>(null);
	let addedIds = $state<Record<string, boolean>>({});
	let errorMessage = $state('');

	let filteredLayers = $derived(
		layers.filter((layer) => layer.label.toLowerCase().includes(query.trim().toLowerCase()))
	);

	async function handleAdd(layer: PublicLayer) {
		addingId = layer.id;
		errorMessage = '';
		try {
			await onAdd(layer);
			addedIds[layer.id] = true;
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : 'Unknown error';
		} finally {
			addingId = null;
		}
	}
</script>

<div>
	<PageHeader
		title="Browse Public Layers"
		subheading="Add layers from the public library to your organization's map."
	/>

	<div class="flex w-full max-w-2xl flex-col gap-4">
		<TextInput
			bind:value={query}
			type="search"
			placeholder="Search layers..."
			aria-label="Search layers"
		/>

		{#if errorMessage}
			<p class="text-error text-sm" role="alert">{errorMessage}</p>
		{/if}

		{#if filteredLayers.length === 0}
			<p class="text-on-surface-subtle py-8 text-center text-sm">
				{layers.length === 0 ? 'No public layers are available yet.' : 'No layers match your search.'}
			</p>
		{:else}
			<ul class="border-outline divide-outline divide-y rounded-sm border">
				{#each filteredLayers as layer (layer.id)}
					<li class="flex flex-row items-center justify-between gap-4 px-4 py-3">
						<div class="min-w-0">
							<p class="text-on-surface truncate font-medium">{layer.label}</p>
							{#if layer.description}
								<p class="text-on-surface-subtle truncate text-sm">{layer.description}</p>
							{/if}
						</div>
						{#if addedIds[layer.id]}
							<Button size="sm" variant="outline" disabled>Added</Button>
						{:else}
							<Button size="sm" loading={addingId === layer.id} onclick={() => handleAdd(layer)}>
								Add
							</Button>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>
