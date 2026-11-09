<script lang="ts">
	import { tick, untrack } from 'svelte';
	import Button from '$components/actions/button/Button.svelte';
	import Spinner from '$components/feedback/spinner/Spinner.svelte';
	import FormField from '$components/data-inputs/form-field/FormField.svelte';
	import TextInput from '$components/data-inputs/text-input/TextInput.svelte';
	import Textarea from '$components/data-inputs/textarea/Textarea.svelte';
	import RadioGroup from '$components/data-inputs/radio-group/RadioGroup.svelte';
	import Checkbox from '$components/data-inputs/checkbox/Checkbox.svelte';
	import { Form } from '$lib/client/formstorm/form.svelte';
	import {
		createOrganizationSchema,
		organizationSlugSchema,
		ORGANIZATION_DESCRIPTION_MAX,
		type CreateOrganizationInput,
		type OrganizationCategory
	} from '$lib/shared/schemas/organizations';
	import { slugFromName } from '$lib/shared/utils/slug';
	import { ArrowLeftIcon } from 'phosphor-svelte';

	interface Props {
		onCreate: (values: CreateOrganizationInput) => Promise<void>;
		/**
		 * Whether a slug is free (true) or already used (false). Asked as the user types, so a taken
		 * slug is flagged before they submit. If it throws, the check is skipped and the server's
		 * answer on submit is used.
		 */
		checkSlug?: (slug: string) => Promise<boolean>;
		/** How long the slug must sit unchanged before it is checked. */
		slugCheckDelayMs?: number;
		/** Where the back button goes. */
		backHref?: string;
	}

	const { onCreate, checkSlug, slugCheckDelayMs = 350, backHref = '/orgs' }: Props = $props();

	const SLUG_TAKEN = 'That slug is already taken.';

	const form = new Form(
		createOrganizationSchema,
		async (values) => {
			await onCreate(values);
		},
		// Nothing chosen until the user picks; zod-empty would otherwise preselect the first option.
		{ category: undefined }
	);

	const CATEGORIES: { value: OrganizationCategory; label: string; description: string }[] = [
		{
			value: 'political',
			label: 'Political or civic',
			description:
				'Candidates and campaigns, PACs, advocacy and lobbying groups, and non-profits working on elections or policy, partisan or non-partisan. Some extra rules apply to political organizations.'
		},
		{
			value: 'nonprofit',
			label: 'Non-profit',
			description:
				'Community, charitable, faith, and service organizations whose canvassing is not about elections or policy.'
		},
		{
			value: 'commercial',
			label: 'Business',
			description: 'Companies canvassing for sales, customer outreach, or market research.'
		}
	];

	// Each step lists the fields it asks for, so Continue only checks those.
	const STEPS = [
		{
			title: 'What kind of organization is this?',
			fields: ['category', 'is_candidate', 'campaign_registration']
		},
		{ title: 'What does your organization do?', fields: ['description'] },
		{ title: 'Name your organization', fields: ['name', 'slug'] }
	] as const;

	let step = $state(0);
	let stepHeading = $state<HTMLHeadingElement>();
	const isLastStep = $derived(step === STEPS.length - 1);
	const isPolitical = $derived(form.values.category === 'political');

	function stepHasErrors(index: number) {
		return STEPS[index].fields.some((field) => (form.errors[field]?.length ?? 0) > 0);
	}

	// Move focus to the new step's heading so screen readers announce it.
	async function goTo(index: number) {
		step = index;
		await tick();
		stepHeading?.focus();
	}

	function next() {
		for (const field of STEPS[step].fields) form.touch(field);
		if (!stepHasErrors(step)) goTo(step + 1);
	}

	async function submit() {
		await form.submit();
		// Earlier steps are checked on Continue, but send the user back if one is still invalid.
		const first = STEPS.findIndex((_, index) => stepHasErrors(index));
		if (first !== -1 && first < step) goTo(first);
	}

	let checkingSlug = $state(false);
	// Shown straight away, unlike other errors, which wait until the field has been left.
	const slugTaken = $derived(form.errors.slug?.includes(SLUG_TAKEN) ?? false);
	// Lead with the taken message: schema errors are from the last validate(), which can predate
	// the slug being typed (Continue validates the whole form).
	const slugErrors = $derived(slugTaken ? [SLUG_TAKEN] : (form.errors.slug ?? []));

	// Same spacing for both fields: 8px between label and input, with the label sized to match
	// the input text. The helper is pulled up to 4px under its input so it reads as part of it.
	const fieldClass = 'gap-2! [&_label]:text-base [&>p]:text-sm [&>p]:-mt-1';

	function onNameInput(e: Event) {
		form.values.slug = slugFromName((e.target as HTMLInputElement).value);
	}

	// Whenever the slug changes: drop the old answer, then ask once typing pauses. A slug that is
	// not well formed is left to the schema, and a stale answer is ignored.
	$effect(() => {
		const slug = form.values.slug;
		untrack(() => form.clearFieldError('slug'));
		checkingSlug = false;
		if (!checkSlug || !organizationSlugSchema.safeParse(slug).success) return;

		let stale = false;
		checkingSlug = true;
		const timer = setTimeout(async () => {
			try {
				const available = await checkSlug(slug);
				if (!stale && !available) form.setFieldError('slug', SLUG_TAKEN);
			} catch {
				// Could not check. The server checks again when the form is submitted.
			} finally {
				if (!stale) checkingSlug = false;
			}
		}, slugCheckDelayMs);

		return () => {
			stale = true;
			clearTimeout(timer);
		};
	});
</script>

<div class="relative min-h-dvh flex items-center justify-center p-6">
	<div class="absolute top-4 left-4">
		<Button variant="ghost" href={backHref}>
			<ArrowLeftIcon />
			Back
		</Button>
	</div>

	<div class="w-full max-w-xl flex flex-col gap-10">
		<h1
			class="text-center text-3xl sm:text-4xl sm:whitespace-nowrap font-bold tracking-tight text-on-surface select-none"
		>
			Create Organization
		</h1>

		<form
			onsubmit={(e) => {
				e.preventDefault();
				if (isLastStep) submit();
				else next();
			}}
			novalidate
			class="flex flex-col gap-6 w-full max-w-md mx-auto"
		>
			<div class="flex flex-col gap-3">
				<ol class="flex gap-2" aria-label="Progress">
					{#each STEPS as s, index (s.title)}
						<li
							class={['h-1 flex-1 rounded-full', index <= step ? 'bg-primary' : 'bg-outline'].join(
								' '
							)}
							aria-current={index === step ? 'step' : undefined}
						>
							<span class="sr-only">{s.title}</span>
						</li>
					{/each}
				</ol>
				<p class="text-sm text-on-surface-subtle">Step {step + 1} of {STEPS.length}</p>
				<h2
					bind:this={stepHeading}
					tabindex="-1"
					class="text-xl font-semibold text-on-surface outline-none"
				>
					{STEPS[step].title}
				</h2>
			</div>

			{#if step === 0}
				<RadioGroup
					label="Organization type"
					class="[&>legend]:sr-only"
					items={CATEGORIES}
					bind:value={
						() => form.values.category ?? '',
						(value) => {
							form.values.category = value as OrganizationCategory;
							form.touch('category');
						}
					}
					errors={form.errors.category ?? []}
					dirty={!!form.touched.category}
				/>

				{#if isPolitical}
					<div class="flex flex-col gap-4 border-l-2 border-outline pl-4">
						<Checkbox bind:checked={form.values.is_candidate}>
							We are a candidate, or a candidate's campaign, running for office
						</Checkbox>

						{#if form.values.is_candidate}
							<FormField
								label="Campaign registration"
								id="org-campaign-registration"
								class={fieldClass}
								errors={form.errors.campaign_registration ?? []}
								dirty={!!form.touched.campaign_registration}
							>
								<TextInput
									bind:value={form.values.campaign_registration}
									onfocusout={() => form.touch('campaign_registration')}
									placeholder="FEC ID or link"
								/>
								{#snippet helperContent()}
									Your FEC committee ID, or a link to your state or local filing if you are not
									running for federal office.
								{/snippet}
							</FormField>
						{/if}
					</div>
				{/if}
			{:else if step === 1}
				<FormField
					label="Description"
					id="org-description"
					class={fieldClass}
					errors={form.errors.description ?? []}
					dirty={!!form.touched.description}
				>
					<Textarea
						bind:value={form.values.description}
						onfocusout={() => form.touch('description')}
						rows={5}
						maxlength={ORGANIZATION_DESCRIPTION_MAX}
						placeholder="Who you are, what you work on, and who you plan to canvass."
					/>
					{#snippet helperContent()}
						A few sentences is plenty.
					{/snippet}
				</FormField>
			{:else}
				<FormField
					label="Name"
					id="org-name"
					class={fieldClass}
					errors={form.errors.name ?? []}
					dirty={!!form.touched.name}
				>
					<TextInput
						bind:value={form.values.name}
						oninput={onNameInput}
						onfocusout={() => form.touch('name')}
						placeholder="Your Organization's Name"
						required
					/>
				</FormField>

				<FormField
					label="Slug"
					id="org-slug"
					class={fieldClass}
					errors={slugErrors}
					dirty={!!form.touched.slug || slugTaken}
				>
					<div class="relative">
						<TextInput
							bind:value={form.values.slug}
							onfocusout={() => form.touch('slug')}
							placeholder="your-organizations-name"
							required
							class="font-mono pr-10!"
						/>
						{#if checkingSlug}
							<span
								class="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-subtle pointer-events-none"
							>
								<Spinner size={18} />
							</span>
						{/if}
						<!-- The spinner is decorative, so say it out loud for screen readers. -->
						<span class="sr-only" role="status">{checkingSlug ? 'Checking availability' : ''}</span>
					</div>
					{#snippet helperContent()}
						Used in URLs: /o/{form.values.slug || 'your-org'}/
					{/snippet}
				</FormField>
			{/if}

			{#if form.errorMessage}
				<p class="text-sm text-red-600" role="alert">{form.errorMessage}</p>
			{/if}

			<div class="flex gap-3">
				{#if step > 0}
					<Button
						type="button"
						variant="outline"
						class="flex-1"
						disabled={form.submitting}
						onclick={() => goTo(step - 1)}
					>
						Previous
					</Button>
				{/if}
				{#if isLastStep}
					<Button type="submit" class="flex-1" loading={form.submitting}>
						{form.submitting ? 'Creating…' : 'Create Organization'}
					</Button>
				{:else}
					<Button type="submit" class="flex-1">Continue</Button>
				{/if}
			</div>
		</form>
	</div>
</div>
