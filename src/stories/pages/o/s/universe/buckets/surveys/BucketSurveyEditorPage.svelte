<script lang="ts">
	import Button from '$components/actions/button/Button.svelte';
	import FormField from '$components/data-inputs/form-field/FormField.svelte';
	import Select from '$components/data-inputs/select/Select.svelte';
	import TextInput from '$components/data-inputs/text-input/TextInput.svelte';
	import Textarea from '$components/data-inputs/textarea/Textarea.svelte';
	import { untrack, onMount } from 'svelte';
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';

	export interface SurveyQuestion {
		db_id?: string;
		type: string;
		text: string;
		choices: string[];
		index: number;
	}

	interface Props {
		surveyName: string;
		surveyDescription: string;
		bucketName: string;
		questions: SurveyQuestion[];
		onSave: (data: { name: string; description: string; questions: SurveyQuestion[] }) => Promise<void>;
	}

	const { surveyName, surveyDescription, bucketName, questions: initialQuestions, onSave }: Props = $props();

	interface SurveyState {
		name: string;
		description: string;
		questions: SurveyQuestion[];
	}

	let survey: SurveyState = $state(untrack(() => ({
		name: surveyName,
		description: surveyDescription,
		questions: initialQuestions.map((q, i) => ({ ...q, index: i }))
	})));

	let saveStatus: 'saving' | 'saved' | null = $state('saved');
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let saveShortcutTimer: ReturnType<typeof setTimeout> | null = null;

	const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

	async function handleSave() {
		if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
		saveStatus = 'saving';
		const start = Date.now();
		try {
			await onSave({ name: survey.name, description: survey.description, questions: survey.questions });
			await sleep(Math.max(0, 1000 - (Date.now() - start)));
			saveStatus = 'saved';
		} catch {
			saveStatus = null;
		}
	}

	function scheduleSave() {
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(handleSave, 350);
	}

	function handleKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 's') {
			e.preventDefault();
			if (saveShortcutTimer) return;
			handleSave();
			saveShortcutTimer = setTimeout(() => (saveShortcutTimer = null), 3000);
		}
	}

	onMount(() => {
		window.addEventListener('keydown', handleKeydown);
		return () => window.removeEventListener('keydown', handleKeydown);
	});

	function updateName(name: string) {
		survey = { ...survey, name };
		scheduleSave();
	}

	function updateDescription(description: string) {
		survey = { ...survey, description };
		scheduleSave();
	}

	function addQuestion() {
		survey = {
			...survey,
			questions: [
				...survey.questions,
				{ type: 'text', text: 'New question', choices: [], index: survey.questions.length }
			]
		};
		scheduleSave();
	}

	function deleteQuestion(index: number) {
		survey.questions.splice(index, 1);
		survey = { ...survey, questions: survey.questions };
		scheduleSave();
	}

	function updateQuestionText(index: number, value: string) {
		survey.questions[index].text = value;
		survey = { ...survey, questions: survey.questions };
		scheduleSave();
	}

	function updateQuestionType(index: number, value: string) {
		survey.questions[index].type = value;
		survey = { ...survey, questions: survey.questions };
		scheduleSave();
	}

	function addQuestionChoice(index: number, value: string) {
		survey.questions[index].choices.push(value);
		survey = { ...survey, questions: survey.questions };
		scheduleSave();
	}

	function deleteQuestionChoice(questionIndex: number, choiceIndex: number) {
		survey.questions[questionIndex].choices.splice(choiceIndex, 1);
		survey = { ...survey, questions: survey.questions };
		scheduleSave();
	}

	function updateQuestionChoice(questionIndex: number, choiceIndex: number, value: string) {
		survey.questions[questionIndex].choices[choiceIndex] = value;
		survey = { ...survey, questions: survey.questions };
		scheduleSave();
	}
</script>

<PageHeader title={survey.name} subheading={bucketName}>
	{#snippet actions()}
		{#if saveStatus === 'saving'}
			<span class="text-sm text-on-surface-subtle">Saving…</span>
		{:else if saveStatus === 'saved'}
			<span class="text-sm text-on-surface-subtle">Saved</span>
		{:else}
			<span class="text-sm text-red-600">Failed to save</span>
		{/if}
	{/snippet}
</PageHeader>

<div class="flex flex-col gap-4 my-4">
	<FormField label="Survey name">
		<TextInput
			value={survey.name}
			oninput={(e: Event) => updateName((e.currentTarget as HTMLInputElement).value)}
		/>
	</FormField>

	<FormField label="Description">
		<Textarea
			value={survey.description}
			oninput={(e: Event) => updateDescription((e.currentTarget as HTMLTextAreaElement).value)}
		/>
	</FormField>
</div>

<h2 class="text-lg font-medium mb-2">Questions</h2>
<Button onclick={addQuestion}>Add Question</Button>
<div class="space-y-4">
	{#each survey.questions as question, index}
		<div class="p-4 rounded shadow space-y-3">
			<div class="flex flex-row font-medium justify-between items-center gap-2">
				<div class="flex flex-row items-center gap-1 flex-1">
					<p>{index + 1}.</p>
					<TextInput
						value={question.text}
						oninput={(e: Event) =>
							updateQuestionText(index, (e.currentTarget as HTMLInputElement).value)}
					/>
				</div>
				<Button onclick={() => deleteQuestion(index)}>Delete</Button>
			</div>

			<FormField label="Question type" labelVisibility="sr-only">
				<Select
					value={question.type}
					items={[
						{ value: 'text', label: 'Text Response' },
						{ value: 'radio', label: 'Choose One Response' },
						{ value: 'check', label: 'Choose Many Response' }
					]}
					oninput={(e: Event) =>
						updateQuestionType(index, (e.currentTarget as HTMLSelectElement).value)}
				/>
			</FormField>

			<div>
				{#if question.type === 'text'}
					<p class="p-2 bg-surface-container-high rounded-lg mt-2">
						Users will submit a text response...
					</p>
				{:else if question.type === 'radio' || question.type === 'check'}
					<Button variant="outline" onclick={() => addQuestionChoice(index, 'New Choice')}>Add Choice</Button>
					<ul class="space-y-2 mt-2">
						{#each question.choices as choice, choiceIndex}
							<li class="flex items-center gap-2">
								<TextInput
									value={choice}
									oninput={(e: Event) =>
										updateQuestionChoice(
											index,
											choiceIndex,
											(e.currentTarget as HTMLInputElement).value
										)}
								/>
								<Button variant="outline" onclick={() => deleteQuestionChoice(index, choiceIndex)}>Delete</Button>
							</li>
						{/each}
					</ul>
				{:else}
					<p>Please select a valid question type...</p>
				{/if}
			</div>
		</div>
	{/each}
</div>
