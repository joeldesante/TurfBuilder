<script lang="ts">
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';
	import EntityBrowserRow from '$components/data-display/entity-browser/EntityBrowserRow.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import ScrollIcon from 'phosphor-svelte/lib/ScrollIcon';
	import PlusIcon from 'phosphor-svelte/lib/Plus';

	interface Script {
		id: string;
		name: string;
		updated_at: string;
	}

	interface Props {
		bucketName: string;
		bucketSlug: string;
		orgSlug: string;
		scripts: Script[];
		createHref: string;
	}

	const { bucketName, bucketSlug, orgSlug, scripts, createHref }: Props = $props();
</script>

<PageHeader title="Scripts" subheading={bucketName}>
	{#snippet actions()}
		<Button href={createHref}>
			<PlusIcon />
			New Script
		</Button>
	{/snippet}
</PageHeader>

<div class="mt-4 border-t border-outline-subtle">
	<div class="flex items-center gap-4 px-4 py-2">
		<div class="w-8 shrink-0"></div>
		<span class="flex-1 text-xs font-medium text-on-surface-subtle uppercase tracking-wide">Name</span>
		<span class="text-xs font-medium text-on-surface-subtle uppercase tracking-wide w-36 text-right">Last Updated</span>
	</div>

	{#each scripts as script}
		<EntityBrowserRow
			name={script.name}
			date={script.updated_at}
			href={`/o/${orgSlug}/s/universe/buckets/${bucketSlug}/scripts/${script.id}`}
			icon={ScrollIcon}
		/>
	{:else}
		<p class="px-4 py-8 text-sm text-on-surface-subtle text-center">No scripts yet.</p>
	{/each}
</div>
