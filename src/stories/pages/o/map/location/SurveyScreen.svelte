<script lang="ts">
	import { browser } from '$app/environment';
	import { ArrowLeftIcon, CaretDownIcon } from 'phosphor-svelte';
	import Button from '$components/actions/button/Button.svelte';
	import FormField from '$components/data-inputs/form-field/FormField.svelte';
	import Textarea from '$components/data-inputs/textarea/Textarea.svelte';
	import SurveyQuestion from '$components/data-inputs/survey-question/SurveyQuestion.svelte';

	type ContactStatus = 'no_contact' | 'contacted' | null;
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
		scriptContent?: string | null;
		contactStatus: ContactStatus;
		questions: SurveyQuestionData[];
		attemptNote?: string;
		backHref: string;
		loading?: boolean;
		onSubmit: () => void;
		class?: string;
		[key: string]: unknown;
	}

	let {
		location,
		scriptContent = null,
		contactStatus = $bindable(null),
		questions = $bindable([]),
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

	let scriptCollapsed = $state(false);
	let renderedScript = $state('');

	$effect(() => {
		const content = scriptContent;
		if (!content || !browser) return;

		(async () => {
			const { Marked } = await import('marked');
			const DOMPurify = (await import('dompurify')).default;

			const instance = new Marked();
			instance.use({
				extensions: [
					{
						name: 'ins',
						level: 'inline' as const,
						start(src: string) {
							return src.indexOf('++');
						},
						tokenizer(src: string) {
							const match = src.match(/^\+\+([^+\n]+)\+\+/);
							if (match) {
								return { type: 'ins', raw: match[0], text: match[1] };
							}
						},
						renderer(token: { text: string }) {
							return `<ins>${token.text}</ins>`;
						}
					}
				]
			});

			const html = await instance.parse(content);
			renderedScript = DOMPurify.sanitize(html);
		})();
	});
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

	{#if scriptContent}
		<section class="rounded-xl border border-outline-subtle overflow-hidden">
			<button
				class="w-full flex items-center justify-between px-4 py-3 text-left bg-surface-container cursor-pointer hover:bg-surface-container-high transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
				onclick={() => (scriptCollapsed = !scriptCollapsed)}
				aria-expanded={!scriptCollapsed}
			>
				<span class="text-base font-semibold text-on-surface">What to say</span>
				<CaretDownIcon
					class="size-4 text-on-surface-subtle transition-transform duration-200 shrink-0 {scriptCollapsed ? '' : 'rotate-180'}"
				/>
			</button>
			{#if !scriptCollapsed}
				<div class="px-4 py-4 script-prose">
					{@html renderedScript}
				</div>
			{/if}
		</section>

		<hr class="border-outline-subtle" />
	{/if}

	<section class="flex flex-col gap-3">
		<p class="text-base font-medium text-on-surface">Were you able to make contact?</p>
		<div class="grid grid-cols-2 gap-2">
			<button
				class="contact-option {contactStatus === 'no_contact' ? 'selected' : ''}"
				onclick={() => (contactStatus = contactStatus === 'no_contact' ? null : 'no_contact')}
			>
				<span class="text-sm font-medium leading-snug">No Answer</span>
				<span class="text-xs leading-snug opacity-70">No contact or turned away</span>
			</button>
			<button
				class="contact-option {contactStatus === 'contacted' ? 'selected' : ''}"
				onclick={() => (contactStatus = contactStatus === 'contacted' ? null : 'contacted')}
			>
				<span class="text-sm font-medium leading-snug">Spoke with Them</span>
				<span class="text-xs leading-snug opacity-70">Open to talking</span>
			</button>
		</div>
	</section>

	{#if contactStatus === 'contacted' && questions.length > 0}
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

	<FormField
		label="Notes"
		helperText="Add any additional context about your interaction or the location."
		for="attemptNote"
	>
		<Textarea bind:value={attemptNote} />
	</FormField>

	<Button onclick={onSubmit} {loading} disabled={loading || contactStatus === null} class="w-full">
		Save
	</Button>
</div>

<style>
	.contact-option {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.25rem;
		padding: 0.875rem 1rem;
		border-radius: 0.75rem;
		border: 1.5px solid var(--outline-subtle);
		background: var(--surface);
		color: var(--on-surface);
		cursor: pointer;
		text-align: left;
		transition: border-color 0.15s, background 0.15s, color 0.15s;
	}

	.contact-option:hover {
		border-color: var(--outline);
		background: var(--surface-container);
	}

	.contact-option.selected {
		border-color: var(--primary);
		background: var(--primary-container);
		color: var(--on-primary-container);
	}

	.script-prose :global(h1) {
		font-size: 1.375rem;
		font-weight: 400;
		line-height: 1.3;
		margin-top: 1.25rem;
		margin-bottom: 1rem;
		color: var(--on-surface);
	}

	.script-prose :global(h1:first-child),
	.script-prose :global(h2:first-child),
	.script-prose :global(h3:first-child) {
		margin-top: 0;
	}

	.script-prose :global(h1:has(+ h2)),
	.script-prose :global(h1:has(+ h3)),
	.script-prose :global(h2:has(+ h3)) {
		margin-bottom: 0.125rem;
	}

	.script-prose :global(h1 + h2),
	.script-prose :global(h1 + h3),
	.script-prose :global(h2 + h3) {
		margin-top: 0;
	}

	.script-prose :global(h2),
	.script-prose :global(h3),
	.script-prose :global(h4),
	.script-prose :global(h5),
	.script-prose :global(h6) {
		font-size: 1.05rem;
		font-weight: 300;
		line-height: 1.4;
		margin-top: 1rem;
		margin-bottom: 0.75rem;
		color: var(--on-surface-subtle);
	}

	.script-prose :global(p) {
		margin-bottom: 0.75rem;
		line-height: 1.6;
	}

	.script-prose :global(p:last-child) {
		margin-bottom: 0;
	}

	.script-prose :global(strong) {
		font-weight: 600;
	}

	.script-prose :global(em) {
		font-style: italic;
	}

	.script-prose :global(u),
	.script-prose :global(ins) {
		text-decoration: underline;
		text-decoration-skip-ink: auto;
	}

	.script-prose :global(code) {
		font-family: ui-monospace, monospace;
		font-size: 0.875em;
		background: var(--surface-container-high);
		color: var(--on-surface);
		padding: 0.15em 0.35em;
		border-radius: 4px;
	}

	.script-prose :global(pre) {
		background: var(--surface-container-high);
		border-radius: 8px;
		padding: 1rem;
		margin-bottom: 0.75rem;
		overflow-x: auto;
	}

	.script-prose :global(pre code) {
		background: none;
		padding: 0;
		border-radius: 0;
		font-size: 0.875rem;
	}

	.script-prose :global(blockquote) {
		border-left: 3px solid var(--outline);
		padding-left: 1rem;
		margin-left: 0;
		margin-bottom: 0.75rem;
		color: var(--on-surface-subtle);
		font-style: italic;
	}

	.script-prose :global(ul) {
		list-style-type: disc;
		padding-left: 1.5rem;
		margin-bottom: 0.75rem;
	}

	.script-prose :global(ol) {
		list-style-type: decimal;
		padding-left: 1.5rem;
		margin-bottom: 0.75rem;
	}

	.script-prose :global(li) {
		margin-bottom: 0.25rem;
		line-height: 1.6;
	}

	.script-prose :global(ul ul),
	.script-prose :global(ol ol),
	.script-prose :global(ul ol),
	.script-prose :global(ol ul) {
		margin-bottom: 0;
	}
</style>
