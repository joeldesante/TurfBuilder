<script lang="ts">
	import { z } from 'zod';
	import { Form } from '$lib/client/formstorm/form.svelte';
	import { ThemeSchema } from '../SetupWizard.robot';
	import FormField from '$components/data-inputs/form-field/FormField.svelte';
	import TextInput from '$components/data-inputs/text-input/TextInput.svelte';
	import Checkbox from '$components/data-inputs/checkbox/Checkbox.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import StepLayout from './StepLayout.svelte';

	interface Props {
		onNext: (values: z.infer<typeof ThemeSchema>) => Promise<void>;
	}

	const { onNext }: Props = $props();

	const form = new Form(ThemeSchema, onNext);
</script>

<form
	onsubmit={(e) => {
		e.preventDefault();
		form.submit();
	}}
>
	<StepLayout title="Appearance" description="Give your installation its own look and name.">
		<FormField
			label="Application name"
			helperText="The name shown in the browser tab and throughout the app, for example your campaign or organization name."
			errors={form.errors.applicationName ?? []}
			dirty={form.touched.applicationName}
		>
			<TextInput
				bind:value={form.values.applicationName}
				onfocusout={() => form.touch('applicationName')}
			/>
		</FormField>
		<div class="flex flex-col gap-1.5">
			<Checkbox bind:checked={form.values.catGifs}>Enable cat gifs</Checkbox>
			<p class="text-sm text-on-surface-subtle">
				Show a fun cat gif while pages are loading. Purely cosmetic.
			</p>
		</div>
		<Button type="submit" class="w-full sm:w-auto" loading={form.submitting}>Next</Button>
	</StepLayout>
</form>
