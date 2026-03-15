<script lang="ts">
	import { page } from '$app/stores';
	import PageHeader from '$components/layout/page-header/PageHeader.svelte';
	import Button from '$components/actions/button/Button.svelte';
	const { data } = $props();
	const orgSlug = $page.params.org_slug;
</script>

<svelte:head>
	<title>{data.survey.name} | {data.config.application_name}</title>
</svelte:head>

<PageHeader
	title={data.survey.name}
	breadcrumbs={[
		{ label: 'Surveys', href: `/o/${orgSlug}/s/data/surveys` },
		{ label: data.survey.name }
	]}
>
	{#snippet actions()}
		<Button variant="outline" href="/o/{orgSlug}/s/data/surveys/{data.survey.id}/edit">Edit</Button>
	{/snippet}
</PageHeader>

<p>
	This survey has no responses yet. Once this survey receives its first response you will not be
	able to modify it.
</p>

<p>{data.survey.descripton}</p>

<hr />

<h2 class="text-lg font-medium mb-2">Questions</h2>
<div class="space-y-4">
	{#each data.questions as question}
		<div class="p-4 rounded shadow">
			<p>{question.question_text}</p>
		</div>
	{/each}
</div>
