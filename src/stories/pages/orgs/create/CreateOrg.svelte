<script lang="ts">
	import { tick, untrack } from 'svelte';
	import Button from '$components/actions/button/Button.svelte';
	import Badge from '$components/data-display/badge/Badge.svelte';
	import CollapsibleCard from '$components/layout/collapsible-card/CollapsibleCard.svelte';
	import StepIndicator from '$components/layout/step-indicator/StepIndicator.svelte';
	import ScrollHint from '$components/feedback/scroll-hint/ScrollHint.svelte';
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
	import { ArrowLeftIcon, HeartIcon } from 'phosphor-svelte';

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

	const VALUE_STATEMENT = {
		intro:
			'TurfBuilder is a mission-driven organization, which is why our hosted tools are available only to campaigns and groups working toward progressive change.',
		eligibleLead: 'Eligible candidates include',
		eligible: [
			'Democrats,',
			'Progressives running under any party line, and',
			'Independents who can show they share progressive values and priorities.'
		],
		outro:
			'PACs, committees, and grassroots movements qualify if their work primarily supports these candidates or advances progressive policy goals. Progressive 501(c)(4) nonprofits may use the platform, and 501(c)(3) organizations are approved at our discretion.',
		closing:
			'TurfBuilder is independent and not affiliated with any political party, but every organizer we serve shares a commitment to building progressive change, one door at a time.',
		contactLead: 'Please contact',
		contactEmail: 'support@turfbuilder.org',
		contactTail: 'with comments, questions, or concerns.'
	};

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
			label: 'Political, Civic, or Social Change',
			description:
				'Candidates and campaigns, PACs, advocacy and lobbying groups, and non-profits working on elections, policy, or social change, partisan or non-partisan. Some extra rules apply to political organizations.'
		},
		{
			value: 'nonprofit',
			label: 'Non-partisan',
			description:
				'Community, charitable, faith, and service organizations whose canvassing is not about elections, politics, or social change.'
		},
		{
			value: 'commercial',
			label: 'Commercial Use',
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

	let valueStatementOpen = $state(true);
	let step = $state(0);
	let stepHeading = $state<HTMLHeadingElement>();
	const isLastStep = $derived(step === STEPS.length - 1);
	const isPolitical = $derived(form.values.category === 'political');

	// The description field sits below the long values card.
	let descriptionAnchor = $state<HTMLDivElement>();
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

<div class="relative min-h-dvh flex flex-col sm:flex-row items-center sm:justify-center gap-4 p-6">
	<!-- In the page flow on phones, where a floating button would sit on top of the heading. -->
	<div class="self-start sm:absolute sm:top-4 sm:left-4">
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
			<StepIndicator steps={STEPS.map((s) => s.title)} current={step} bind:heading={stepHeading} />

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
							We are a candidate or campaign
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
									placeholder="FEC Committee ID"
								/>
								{#snippet labelAction()}
									<Badge size="sm">Optional</Badge>
								{/snippet}
								{#snippet helperContent()}
									No FEC Committee ID? You may leave this field blank.
								{/snippet}
							</FormField>
						{/if}
					</div>
				{/if}
			{:else if step === 1}
				{#if isPolitical}
					<CollapsibleCard title="Our Values" bind:open={valueStatementOpen}>
						{#snippet icon()}<HeartIcon />{/snippet}
						<p>{VALUE_STATEMENT.intro}</p>
						<p>{VALUE_STATEMENT.eligibleLead}</p>
						<ul class="list-disc pl-5 flex flex-col gap-1">
							{#each VALUE_STATEMENT.eligible as item (item)}
								<li>{item}</li>
							{/each}
						</ul>
						<p>{VALUE_STATEMENT.outro}</p>
						<p>{VALUE_STATEMENT.closing}</p>
						<p>
							{VALUE_STATEMENT.contactLead}
							<a href="mailto:{VALUE_STATEMENT.contactEmail}" class="underline text-primary"
								>{VALUE_STATEMENT.contactEmail}</a
							>
							{VALUE_STATEMENT.contactTail}
						</p>
					</CollapsibleCard>
				{/if}
				<div bind:this={descriptionAnchor}>
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
				</div>
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

	<ScrollHint
		target={descriptionAnchor}
		enabled={step === 1 && isPolitical && valueStatementOpen}
		label="Scroll to description"
	/>
</div>
