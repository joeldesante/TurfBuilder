<script>
	import PageHeader from '$components/layout/page-header/PageHeader.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import { PlusIcon } from 'phosphor-svelte';
	let { data } = $props();
	console.log(data.surveys);
</script>

<svelte:head>
	<title>Surveys | {data.config.application_name}</title>
</svelte:head>

<PageHeader title="Surveys">
	{#snippet actions()}
		<Button variant="primary" href="/system/data/surveys/create">
			<PlusIcon />
			Create Survey
		</Button>
	{/snippet}
</PageHeader>

{#each data.surveys as survey}
	<a href="/system/data/surveys/{survey.id}">{survey.name}</a>
{/each}
