<script lang="ts">
	import { untrack } from 'svelte';
	import Button from '$components/actions/button/Button.svelte';
	import Spinner from '$components/feedback/spinner/Spinner.svelte';
	import FormField from '$components/data-inputs/form-field/FormField.svelte';
	import TextInput from '$components/data-inputs/text-input/TextInput.svelte';
	import { Form } from '$lib/client/formstorm/form.svelte';
	import {
		createOrganizationSchema,
		organizationSlugSchema
	} from '$lib/shared/schemas/organizations';
	import { slugFromName } from '$lib/shared/utils/slug';
	import { ArrowLeftIcon } from 'phosphor-svelte';

	interface Props {
		onCreate: (name: string, slug: string) => Promise<void>;
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

	const form = new Form(createOrganizationSchema, async (values) => {
		await onCreate(values.name, values.slug);
	});

	let checkingSlug = $state(false);
	// Shown straight away, unlike other errors, which wait until the field has been left.
	const slugTaken = $derived(form.errors.slug?.includes(SLUG_TAKEN) ?? false);

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
				form.submit();
			}}
			novalidate
			class="flex flex-col gap-6 w-full max-w-md mx-auto"
		>
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
				errors={form.errors.slug ?? []}
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

			{#if form.errorMessage}
				<p class="text-sm text-red-600" role="alert">{form.errorMessage}</p>
			{/if}

			<Button type="submit" loading={form.submitting}>
				{form.submitting ? 'Creating…' : 'Create Organization'}
			</Button>
		</form>
	</div>
</div>
