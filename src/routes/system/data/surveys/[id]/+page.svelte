<script lang="ts">
	import PageHeader from '$components/layout/page-header/PageHeader.svelte';
	import Button from '$components/actions/button/Button.svelte';
	const { data } = $props();
	console.log(data);
</script>

<svelte:head>
	<title>{data.survey.name} | {data.config.application_name}</title>
</svelte:head>

<PageHeader
	title={data.survey.name}
	breadcrumbs={[
		{ label: 'Surveys', href: '/system/data/surveys' },
		{ label: data.survey.name }
	]}
>
	{#snippet actions()}
		<Button variant="outline" href="/system/data/surveys/{data.survey.id}/edit">Edit</Button>
	{/snippet}
</PageHeader>

<p>
	This survey has no responses yet. Once this survey recieves its first response you will not be
	able to modify it.
</p>

<p>{data.survey.descripton}</p>

<hr />

<h2 class="text-lg font-medium mb-2">Questions</h2>
<div class="space-y-4">
	{#each data.questions as question}
		<div class="p-4 rounded shadow">
			<p>{question.question_text}</p>
			<!-- Here based on the type we will render the correct input. Type is selected when adding question. It can not be changed later. -->
		</div>
	{/each}
</div>
