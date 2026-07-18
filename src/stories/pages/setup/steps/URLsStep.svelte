<script lang="ts">
	import { z } from 'zod';
	import { Form } from '$lib/client/formstorm/form.svelte';
	import { URLsSchema } from '../SetupWizard.robot';
	import FormField from '$components/data-inputs/form-field/FormField.svelte';
	import TagInput from '$components/data-inputs/tag-input/TagInput.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import StepLayout from './StepLayout.svelte';

	interface Props {
		onNext: (values: z.infer<typeof URLsSchema>) => Promise<void>;
	}

	const { onNext }: Props = $props();

	const form = new Form(URLsSchema, onNext);
</script>

<form
	onsubmit={(e) => {
		e.preventDefault();
		form.submit();
	}}
>
	<StepLayout
		title="Base URLs"
		description="Tell the app which web addresses people will use to reach it."
	>
		<FormField
			label="Base URLs"
			helperText="Enter the full address people type into their browser to open this app, such as https://example.org. Type an address and press Enter to add it. You can add more than one."
			errors={form.errors.urls ?? []}
			dirty={form.touched.urls}
		>
			<TagInput
				tags={form.values.urls}
				onchange={(tags) => {
					form.values.urls = tags;
					form.touch('urls');
				}}
			/>
		</FormField>
		<Button type="submit" class="w-full sm:w-auto" loading={form.submitting}>Next</Button>
	</StepLayout>
</form>
