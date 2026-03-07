<script lang="ts">
	import SurveyAnswerOption from '../survey-answer-option/SurveyAnswerOption.svelte';
	import Textarea from '../textarea/Textarea.svelte';

	type QuestionType = 'radio' | 'check' | 'text';

	interface Props {
		questionNumber: number;
		questionText: string;
		questionType: QuestionType;
		choices?: string[];
		value?: string;
		disabled?: boolean;
		class?: string;
		[key: string]: unknown;
	}

	let {
		questionNumber,
		questionText,
		questionType,
		choices = [],
		value = $bindable(''),
		disabled = false,
		class: className = '',
		...restProps
	}: Props = $props();

	let radioName = `survey-q-${questionNumber}`;

	let selectedCheckboxes = $derived(
		questionType === 'check' && value ? value.split(',').filter((v) => v) : []
	);

	function handleRadioChange(choice: string) {
		if (disabled) return;
		value = choice;
	}

	function handleCheckboxChange(choice: string) {
		if (disabled) return;
		const current = value ? value.split(',').filter((v) => v) : [];
		if (current.includes(choice)) {
			value = current.filter((c) => c !== choice).join(',');
		} else {
			value = [...current, choice].join(',');
		}
	}

	let computedClass = $derived(['flex flex-col gap-3', className].filter(Boolean).join(' '));
</script>

<div class={computedClass} {...restProps}>
	<p class="text-lg font-medium text-on-surface">
		<span class="font-semibold">{questionNumber}.</span>
		{questionText}
	</p>

	{#if questionType === 'radio'}
		<div class="flex flex-col gap-2" role="radiogroup" aria-label={questionText}>
			{#each choices as choice (choice)}
				<SurveyAnswerOption
					type="radio"
					label={choice}
					name={radioName}
					value={choice}
					selected={value === choice}
					{disabled}
					onchange={() => handleRadioChange(choice)}
				/>
			{/each}
		</div>
		{#if value && !disabled}
			<button
				type="button"
				class="self-start text-sm text-on-surface-subtle underline hover:text-on-surface"
				onclick={() => (value = '')}
			>
				Clear selection
			</button>
		{/if}
	{:else if questionType === 'check'}
		<div class="flex flex-col gap-2" role="group" aria-label={questionText}>
			{#each choices as choice (choice)}
				<SurveyAnswerOption
					type="checkbox"
					label={choice}
					value={choice}
					selected={selectedCheckboxes.includes(choice)}
					{disabled}
					onchange={() => handleCheckboxChange(choice)}
				/>
			{/each}
		</div>
	{:else}
		<Textarea bind:value placeholder="Enter your response..." rows={3} {disabled} />
	{/if}
</div>
