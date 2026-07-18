<script lang="ts">
	import { z } from 'zod';
	import { Form } from '$lib/client/formstorm/form.svelte';
	import { OrgSettingsSchema } from '../SetupWizard.robot';
	import Checkbox from '$components/data-inputs/checkbox/Checkbox.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import StepLayout from './StepLayout.svelte';

	interface Props {
		onNext: (values: z.infer<typeof OrgSettingsSchema>) => Promise<void>;
	}

	const { onNext }: Props = $props();

	const form = new Form(OrgSettingsSchema, onNext);
</script>

<form
	onsubmit={(e) => {
		e.preventDefault();
		form.submit();
	}}
>
	<StepLayout
		title="Organizations"
		description="Control who can start new organizations on this installation."
	>
		<div class="flex flex-col gap-1.5">
			<Checkbox bind:checked={form.values.canCreateNewOrgs}
				>Allow creating new organizations</Checkbox
			>
			<p class="text-sm text-on-surface-subtle">
				When enabled, anyone with an account can create their own organization. Turn this off if
				only administrators should be able to create them.
			</p>
		</div>
		<Button type="submit" class="w-full sm:w-auto" loading={form.submitting}>Next</Button>
	</StepLayout>
</form>
