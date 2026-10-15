<script lang="ts">
	import Dropdown from '$components/data-inputs/dropdown/Dropdown.svelte';
	import TextInput from '$components/data-inputs/text-input/TextInput.svelte';
	import type { SourceBucket, SourceQuestion, SourceSurvey, FilterSource } from '$lib/client/filter-source';
	import type { SurveyResponseValue } from '$lib/shared/types/filters';

	interface Props {
		/** Where the buckets, surveys, and questions come from. */
		source: FilterSource;
		/** The current choice; null until a bucket is picked. */
		value: SurveyResponseValue | null;
		onchange: (value: SurveyResponseValue) => void;
	}

	const { source, value, onchange }: Props = $props();

	let buckets = $state<SourceBucket[]>([]);
	let surveys = $state<SourceSurvey[]>([]);
	let questions = $state<SourceQuestion[]>([]);
	let failed = $state(false);

	const bucketId = $derived(value?.bucketId ?? '');
	const surveyId = $derived(value?.surveyId ?? '');
	const questionId = $derived(value?.questionId ?? '');

	const question = $derived(questions.find((q) => q.id === questionId));
	const hasChoices = $derived(!!question && question.choices.length > 0);

	/** Loads a list, ignoring the answer once the inputs it was asked for have changed. */
	function load<T>(fetcher: (() => Promise<T[]>) | null, set: (rows: T[]) => void): () => void {
		let stale = false;
		if (!fetcher) {
			set([]);
			return () => {};
		}
		fetcher().then(
			(rows) => {
				if (stale) return;
				failed = false;
				set(rows);
			},
			() => {
				if (stale) return;
				failed = true;
				set([]);
			}
		);
		return () => {
			stale = true;
		};
	}

	$effect(() => load(() => source.listBuckets(), (rows) => (buckets = rows)));
	$effect(() => {
		const id = bucketId;
		return load(id ? () => source.listSurveys(id) : null, (rows) => (surveys = rows));
	});
	$effect(() => {
		const id = surveyId;
		return load(id ? () => source.listQuestions(id) : null, (rows) => (questions = rows));
	});

	function choose(next: Partial<SurveyResponseValue>) {
		onchange({ bucketId: '', surveyId: '', questionId: '', response: '', ...value, ...next });
	}
</script>

<div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
	<Dropdown
		class="min-w-0 max-w-56"
		aria-label="Bucket"
		placeholder="Choose bucket"
		items={buckets.map((b) => ({ value: b.id, label: b.name }))}
		value={bucketId}
		onValueChange={(next) => choose({ bucketId: next, surveyId: '', questionId: '', response: '' })}
	/>

	{#if bucketId}
		<Dropdown
			class="min-w-0 max-w-56"
			aria-label="Survey"
			placeholder="Choose survey"
			items={surveys.map((s) => ({ value: s.id, label: s.name }))}
			value={surveyId}
			onValueChange={(next) => choose({ surveyId: next, questionId: '', response: '' })}
		/>
	{/if}

	{#if surveyId}
		<Dropdown
			class="min-w-0 max-w-72"
			aria-label="Question"
			placeholder="Choose question"
			items={questions.map((q) => ({ value: q.id, label: q.question_text }))}
			value={questionId}
			onValueChange={(next) => choose({ questionId: next, response: '' })}
		/>
	{/if}

	{#if questionId && question}
		{#if hasChoices}
			<Dropdown
				class="min-w-0 max-w-56"
				aria-label="Response"
				placeholder="Choose response"
				items={question.choices.map((c) => ({ value: c, label: c }))}
				value={value?.response ?? ''}
				onValueChange={(next) => choose({ response: next })}
			/>
		{:else}
			<TextInput
				class="w-48"
				aria-label="Response"
				value={value?.response ?? ''}
				oninput={(e: Event) => choose({ response: (e.currentTarget as HTMLInputElement).value })}
			/>
		{/if}
	{/if}

	{#if failed}
		<span class="text-sm text-error">The survey choices could not be loaded.</span>
	{/if}
</div>
