<script lang="ts">
	import { z } from 'zod';
	import { Form } from '$lib/client/formstorm/form.svelte';
	import { TelemetrySchema } from '../SetupWizard.robot';
	import Checkbox from '$components/data-inputs/checkbox/Checkbox.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import StepLayout from './StepLayout.svelte';

	interface Props {
		onNext: (values: z.infer<typeof TelemetrySchema>) => Promise<void>;
	}

	const { onNext }: Props = $props();

	const form = new Form(TelemetrySchema, onNext);
</script>

<form
	onsubmit={(e) => {
		e.preventDefault();
		form.submit();
	}}
>
	<StepLayout
		title="Telemetry"
		description="Decide whether this installation shares anonymous usage information to help improve the software."
	>
		<div class="flex flex-col gap-1.5">
			<Checkbox bind:checked={form.values.telemetry}>Enable telemetry</Checkbox>
			<p class="text-sm text-on-surface-subtle">
				When enabled, anonymous statistics about how the app is used are sent to the developers. No
				personal information is ever included.
			</p>
		</div>
		<Button type="submit" class="w-full sm:w-auto" loading={form.submitting}>Next</Button>
	</StepLayout>
</form>
