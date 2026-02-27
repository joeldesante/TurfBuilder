<script lang="ts">
	import { ArrowLeftIcon } from 'phosphor-svelte';
	import Button from '$components/actions/button/Button.svelte';
	import Switch from '$components/data-inputs/switch/Switch.svelte';
	import FormField from '$components/data-inputs/form-field/FormField.svelte';
	import Textarea from '$components/data-inputs/textarea/Textarea.svelte';
	import SurveyQuestion from '$components/data-inputs/survey-question/SurveyQuestion.svelte';

	type QuestionType = 'radio' | 'check' | 'text';

	interface SurveyQuestionData {
		db_id: string;
		type: QuestionType;
		text: string;
		choices: string[];
		index: number;
		response: string;
	}

	interface LocationData {
		location_name: string;
		street: string;
		locality: string;
		region: string;
		postcode: string;
	}

	interface Props {
		location: LocationData;
		questions: SurveyQuestionData[];
		contactMade?: boolean;
		attemptNote?: string;
		backHref: string;
		loading?: boolean;
		onSubmit: () => void;
		class?: string;
		[key: string]: unknown;
	}

	let {
		location,
		questions = $bindable([]),
		contactMade = $bindable(false),
		attemptNote = $bindable(''),
		backHref,
		loading = false,
		onSubmit,
		class: className = '',
		...restProps
	}: Props = $props();

	let computedClass = $derived(
		['max-w-2xl mx-auto px-4 py-6 flex flex-col gap-6', className].filter(Boolean).join(' ')
	);
</script>

<div class={computedClass} {...restProps}>
	<!-- eslint-disable svelte/no-navigation-without-resolve -- backHref is pre-resolved by the caller -->
	<a
		href={backHref}
		class="inline-flex items-center gap-1 text-base text-on-surface-subtle no-underline hover:text-on-surface [&>svg]:size-5"
	>
		<ArrowLeftIcon />
		Back to map
	</a>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->

	<section>
		<h1 class="text-2xl font-bold text-on-surface">{location.location_name}</h1>
		<p class="text-base text-on-surface-subtle mt-1">{location.street}</p>
	</section>

	<hr class="border-outline-subtle" />

	<section class="flex items-center gap-3 py-2">
		<Switch bind:checked={contactMade}>
			<span class="text-lg">Did you speak with them?</span>
		</Switch>
	</section>

	{#if contactMade && questions.length > 0}
		<hr class="border-outline-subtle" />

		<section class="flex flex-col gap-8">
			{#each questions as question, index (question.db_id)}
				<SurveyQuestion
					questionNumber={index + 1}
					questionText={question.text}
					questionType={question.type}
					choices={question.choices}
					bind:value={question.response}
				/>
			{/each}
		</section>
	{/if}

	<hr class="border-outline-subtle" />

	<FormField label="Notes" helperText="Add any additional context about your interaction or the location that you'd like to share." for="attemptNote">
		<Textarea bind:value={attemptNote} />
	</FormField>

	<Button onclick={onSubmit} {loading} disabled={loading} class="w-full">
		Submit Response
	</Button>
</div>
