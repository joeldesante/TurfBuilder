<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import PageHeader from '$components/layout/page-header/PageHeader.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import TextInput from '$components/data-inputs/text-input/TextInput.svelte';
	import FormField from '$components/data-inputs/form-field/FormField.svelte';

	const { data } = $props();
	const orgSlug = $page.params.org_slug;

	let codeInput = $state(data.code ?? '');

	function search() {
		if (codeInput.trim()) {
			goto(`?code=${codeInput.trim().toUpperCase()}`);
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') search();
	}
</script>

<svelte:head>
	<title>Survey Responses | {data.config.application_name}</title>
</svelte:head>

<PageHeader
	title="Survey Responses"
	breadcrumbs={[{ label: 'Surveys', href: `/o/${orgSlug}/s/data/surveys` }, { label: 'Survey Responses' }]}
/>

<div class="flex gap-2 items-end mb-6">
	<FormField label="Map Code">
		<TextInput
			placeholder="e.g. AB12CD"
			value={codeInput}
			oninput={(e) => (codeInput = (e.target as HTMLInputElement).value)}
			onkeydown={handleKeydown}
		/>
	</FormField>
	<Button variant="primary" onclick={search}>Look Up</Button>
</div>

{#if data.error}
	<p class="text-red-500">{data.error}</p>
{:else if data.results === null}
	<p class="text-muted">Enter a 6-character map code above to view survey responses.</p>
{:else if data.results.length === 0}
	<p class="text-muted">No survey questions found for turf <strong>{data.code}</strong>.</p>
{:else}
	<p class="text-sm text-muted mb-4">
		Showing responses for turf <strong>{data.code}</strong>
	</p>

	<div class="space-y-6">
		{#each data.results as question}
			<div class="p-4 rounded border border-border bg-surface-elevated shadow-sm">
				<div class="flex items-start justify-between gap-4 mb-3">
					<div>
						<p class="font-medium">{question.question_text}</p>
						<p class="text-xs text-muted capitalize">{question.question_type}</p>
					</div>
					<span class="text-sm text-muted shrink-0">{question.responses.length} response{question.responses.length !== 1 ? 's' : ''}</span>
				</div>

				{#if question.responses.length === 0}
					<p class="text-sm text-muted italic">No responses yet.</p>
				{:else}
					<ul class="divide-y divide-border">
						{#each question.responses as response}
							<li class="py-2 flex items-center justify-between gap-4">
								<span class="text-sm">{response.response_value}</span>
								<div class="flex items-center gap-3 text-xs text-muted">
									{#if response.user_name}
										<span>{response.user_name}</span>
									{/if}
									{#if response.street || response.locality}
										<span>{[response.street, response.locality].filter(Boolean).join(', ')}</span>
									{/if}
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		{/each}
	</div>
{/if}
