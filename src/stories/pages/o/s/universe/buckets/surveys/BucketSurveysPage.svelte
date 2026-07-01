<script lang="ts">
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';
	import EntityBrowserRow from '$components/data-display/entity-browser/EntityBrowserRow.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import ClipboardTextIcon from 'phosphor-svelte/lib/ClipboardText';
	import PlusIcon from 'phosphor-svelte/lib/Plus';

	interface Survey {
		id: string;
		name: string;
		updated_at: string;
	}

	interface Props {
		bucketName: string;
		bucketSlug: string;
		orgSlug: string;
		surveys: Survey[];
	}

	const { bucketName, bucketSlug, orgSlug, surveys }: Props = $props();
</script>

<PageHeader title="Surveys" subheading={bucketName}>
	{#snippet actions()}
		<Button href={`/o/${orgSlug}/s/universe/buckets/${bucketSlug}/surveys/new`}>
			<PlusIcon />
			New Survey
		</Button>
	{/snippet}
</PageHeader>

<div class="mt-4 border-t border-outline-subtle">
	<div class="flex items-center gap-4 px-4 py-2">
		<div class="w-8 shrink-0"></div>
		<span class="flex-1 text-xs font-medium text-on-surface-subtle uppercase tracking-wide">Name</span>
		<span class="text-xs font-medium text-on-surface-subtle uppercase tracking-wide w-36 text-right">Last Updated</span>
	</div>

	{#each surveys as survey}
		<EntityBrowserRow
			name={survey.name}
			date={survey.updated_at}
			href={`/o/${orgSlug}/s/universe/buckets/${bucketSlug}/surveys/${survey.id}`}
			icon={ClipboardTextIcon}
		/>
	{:else}
		<p class="px-4 py-8 text-sm text-on-surface-subtle text-center">No surveys yet.</p>
	{/each}
</div>
