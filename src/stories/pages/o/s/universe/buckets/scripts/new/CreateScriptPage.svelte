<script lang="ts">
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import FormField from '$components/data-inputs/form-field/FormField.svelte';
	import TextInput from '$components/data-inputs/text-input/TextInput.svelte';
	import { Form } from '$lib/client/formstorm/form.svelte';
	import { createNamedResourceSchema } from '$lib/shared/schemas/named-resource';

	interface Props {
		onCreate: (name: string) => Promise<void>;
	}

	const { onCreate }: Props = $props();

	const form = new Form(createNamedResourceSchema, async (values) => {
		await onCreate(values.name);
	});
</script>

<div class="max-w-md mx-auto pt-16 px-4">
	<button
		type="button"
		onclick={() => history.back()}
		class="flex items-center gap-1 text-sm text-on-surface-subtle hover:text-on-surface transition-colors mb-6"
	>
		&larr; Back
	</button>

	<PageHeader title="New Script" />

	<form
		onsubmit={(e) => {
			e.preventDefault();
			form.submit();
		}}
		novalidate
		class="flex flex-col gap-4 mt-6"
	>
		<FormField
			label="Name"
			id="script-name"
			errors={form.errors.name ?? []}
			dirty={!!form.touched.name}
		>
			<TextInput
				bind:value={form.values.name}
				onfocusout={() => form.touch('name')}
				placeholder="Door Knock Script"
				required
			/>
		</FormField>

		{#if form.errorMessage}
			<p class="text-sm text-red-600" role="alert">{form.errorMessage}</p>
		{/if}

		<Button type="submit" loading={form.submitting}>
			{form.submitting ? 'Creating…' : 'Create Script'}
		</Button>
	</form>
</div>
