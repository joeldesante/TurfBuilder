<script lang="ts">
	import Button from '$components/actions/button/Button.svelte';
	import FormField from '$components/data-inputs/form-field/FormField.svelte';
	import Select from '$components/data-inputs/select/Select.svelte';
	import TextInput from '$components/data-inputs/text-input/TextInput.svelte';
	import Textarea from '$components/data-inputs/textarea/Textarea.svelte';

	const { data } = $props();
	console.log(data);

	interface Survey {
		name: string;
		description: string;
		questions: SurveyQuestion[];
	}

	interface SurveyQuestion {
		db_id?: number;
		type: string;
		text: string;
		choices: string[];
		index: number;
	}

	let survey: Survey = $state({
		name: data.survey.name,
		description: data.survey.description,
		questions: data.questions.map((question: any, index: number): SurveyQuestion => {
			return {
				db_id: parseInt(question.id),
				type: question.question_type as string,
				text: question.question_text as string,
				choices: question.question_choices || [],
				index: index
			};
		})
	});
	let unsavedChanges: boolean = $state(false);

	function updateSurveyName(name: string) {
		survey = {
			...survey,
			name: name
		};
		unsavedChanges = true;
	}

	function updateSurveyDescription(description: string) {
		survey = {
			...survey,
			description: description
		};
		unsavedChanges = true;
	}

	function addQuestion() {
		survey = {
			...survey,
			questions: [
				...survey.questions,
				{
					type: 'text',
					text: 'New question',
					choices: [],
					index: survey.questions.length
				}
			]
		};
		unsavedChanges = true;
	}

	function deleteQuestion(index: number) {
		survey.questions.splice(index, 1);
		survey = {
			...survey,
			questions: survey.questions
		};
		unsavedChanges = true;
	}

	function updateQuestionText(index: number, value: string) {
		survey.questions[index].text = value;
		survey = {
			...survey,
			questions: survey.questions
		};
		unsavedChanges = true;
	}

	function updateQuestionType(index: number, value: string) {
		survey.questions[index].type = value;
		survey = {
			...survey,
			questions: survey.questions
		};
		unsavedChanges = true;
	}

	function addQuestionChoice(index: number, value: string) {
		survey.questions[index].choices.push(value);
		survey = {
			...survey,
			questions: survey.questions
		};
		unsavedChanges = true;
	}

	function deleteQuestionChoice(questionIndex: number, choiceIndex: number) {
		survey.questions[questionIndex].choices.splice(choiceIndex, 1);
		survey = {
			...survey,
			questions: survey.questions
		};
		unsavedChanges = true;
	}

	function updateQuestionChoice(questionIndex: number, choiceIndex: number, value: string) {
		survey.questions[questionIndex].choices[choiceIndex] = value;
		survey = {
			...survey,
			questions: survey.questions
		};
		unsavedChanges = true;
	}

	async function saveChanges() {
		// Verify everything is valid...
		const survey_meta = {
			name: survey.name,
			description: survey.description
		};

		const questions = survey.questions;
		const db_question_ids = questions.filter((v) => v.db_id !== undefined).map((q) => q.db_id);

		//1. Update name and description
		const s1 = await fetch(`/api/surveys/${data.survey.id}`, {
			method: 'PUT',
			body: JSON.stringify({
				name: survey.name,
				description: survey.description
			})
		});

		//2. Delete any question which id no longer exists in the question set
		const s2 = await fetch(`/api/surveys/${data.survey.id}/questions/purge`, {
			method: 'POST',
			body: JSON.stringify({
				exclude: db_question_ids
			})
		});

		//3. Update and add any question.. also update the order index..
		const s3 = await fetch(`/api/surveys/${data.survey.id}/questions`, {
			method: 'POST',
			body: JSON.stringify({
				questions: survey.questions
			})
		});

		if (s1.ok && s2.ok && s3.ok) {
			unsavedChanges = false;
		}
	}
</script>

{#if unsavedChanges == true}
	<div
		class="flex justify-between items-center p-2 px-4 bg-surface border fadeInAndUp rounded absolute bottom-0 left-0 right-0 m-4 shadow-lg"
	>
		<p class="font-medium text-primary">You have unsaved changes</p>
		<Button onclick={saveChanges}>Save Changes</Button>
	</div>
{/if}

<div class="m-2 flex flex-row gap-2">
	<Button variant="outline" onclick={saveChanges}>Save Changes</Button>
	<Button onclick={null}>Publish</Button>
</div>

<div class="flex flex-col gap-4 my-4">
	<FormField label="Survey name">
		<TextInput
			value={survey.name}
			oninput={(e: Event) => updateSurveyName((e.currentTarget as HTMLInputElement).value)}
		/>
	</FormField>

	<FormField label="Description">
		<Textarea
			value={survey.description}
			oninput={(e: Event) =>
				updateSurveyDescription((e.currentTarget as HTMLTextAreaElement).value)}
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
				{#if question.type == 'text'}
					<p class="p-2 bg-surface-container-high rounded-lg mt-2">
						Users will submit a text response...
					</p>
				{:else if question.type == 'radio' || question.type == 'check'}
					<Button variant="outline" onclick={() => addQuestionChoice(index, 'New Choice')}
						>Add Choice</Button
					>
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
								<Button variant="outline" onclick={() => deleteQuestionChoice(index, choiceIndex)}
									>Delete</Button
								>
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

<style>
	@keyframes fadeInUp {
		0% {
			opacity: 0;
			transform: translateY(20px); /* Starts 20px below its final position */
		}
		100% {
			opacity: 1;
			transform: translateY(0); /* Ends at its original vertical position */
		}
	}

	.fadeInAndUp {
		animation-name: fadeInUp;
		animation-duration: 0.2s; /* Adjust duration as needed */
		animation-timing-function: ease-out; /* Optional: adds a natural feel */
		animation-fill-mode: backwards; /* Ensures the element is hidden before animation starts */
	}
</style>
