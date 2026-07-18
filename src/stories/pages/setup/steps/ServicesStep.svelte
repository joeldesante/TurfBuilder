<script lang="ts">
	import { z } from 'zod';
	import { Form } from '$lib/client/formstorm/form.svelte';
	import { ServicesSchema } from '../SetupWizard.robot';
	import FormField from '$components/data-inputs/form-field/FormField.svelte';
	import TextInput from '$components/data-inputs/text-input/TextInput.svelte';
	import Checkbox from '$components/data-inputs/checkbox/Checkbox.svelte';
	import Select from '$components/data-inputs/select/Select.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import StepLayout from './StepLayout.svelte';

	interface Props {
		onNext: (values: z.infer<typeof ServicesSchema>) => Promise<void>;
	}

	const { onNext }: Props = $props();

	const form = new Form(ServicesSchema, onNext, {
		overture: {
			enabled: false,
			natsHost: '',
			natsPort: 4222,
			apiPort: 0
		},
		email: {
			transport: 'ses',
			domain: '',
			other: { region: '' }
		}
	});
</script>

<form
	onsubmit={(e) => {
		e.preventDefault();
		form.submit();
	}}
>
	<StepLayout
		title="Services"
		description="Connect optional services. If you are not sure about something here, ask the person who manages your servers."
	>
		<div class="flex flex-col gap-1.5">
			<Checkbox bind:checked={form.values.overture.enabled}>Enable Overture service</Checkbox>
			<p class="text-sm text-on-surface-subtle">
				The Overture service provides building and address data for your maps. Only enable it if it
				has been set up for you.
			</p>
		</div>

		{#if form.values.overture.enabled}
			<FormField
				label="NATS host"
				helperText="The address of the messaging server the Overture service talks to. Provided by whoever set up the service."
				errors={form.errors['overture.natsHost'] ?? []}
				dirty={form.touched['overture.natsHost']}
			>
				<TextInput
					bind:value={form.values.overture.natsHost}
					onfocusout={() => form.touch('overture.natsHost')}
				/>
			</FormField>

			<FormField
				label="NATS port"
				helperText="The port number for the messaging server. The usual value is 4222."
				errors={form.errors['overture.natsPort'] ?? []}
				dirty={form.touched['overture.natsPort']}
			>
				<TextInput
					type="number"
					value={String(form.values.overture.natsPort)}
					oninput={(e: Event) => {
						form.values.overture.natsPort = Number((e.currentTarget as HTMLInputElement).value);
					}}
					onfocusout={() => form.touch('overture.natsPort')}
				/>
			</FormField>

			<FormField
				label="API port"
				helperText="The port number the Overture service answers requests on."
				errors={form.errors['overture.apiPort'] ?? []}
				dirty={form.touched['overture.apiPort']}
			>
				<TextInput
					type="number"
					value={String(form.values.overture.apiPort)}
					oninput={(e: Event) => {
						form.values.overture.apiPort = Number((e.currentTarget as HTMLInputElement).value);
					}}
					onfocusout={() => form.touch('overture.apiPort')}
				/>
			</FormField>
		{/if}

		<FormField
			label="Email transport"
			helperText="How the app sends emails such as invitations. Amazon SES is a paid email service; Direct sends mail straight from this server."
			errors={form.errors['email.transport'] ?? []}
			dirty={form.touched['email.transport']}
		>
			<Select
				bind:value={form.values.email.transport}
				items={[
					{ value: 'ses', label: 'Amazon SES' },
					{ value: 'direct', label: 'Direct' }
				]}
			/>
		</FormField>

		<FormField
			label="Email domain"
			helperText="The part after the @ in the addresses your emails come from, such as example.org."
			errors={form.errors['email.domain'] ?? []}
			dirty={form.touched['email.domain']}
		>
			<TextInput
				bind:value={form.values.email.domain}
				onfocusout={() => form.touch('email.domain')}
			/>
		</FormField>

		{#if form.values.email.transport === 'ses' && form.values.email.other}
			<FormField
				label="SES region"
				helperText="The Amazon data center your SES account uses, such as us-east-1. You can find this in your Amazon account."
				errors={form.errors['email.other.region'] ?? []}
				dirty={form.touched['email.other.region']}
			>
				<TextInput
					bind:value={form.values.email.other.region}
					onfocusout={() => form.touch('email.other.region')}
				/>
			</FormField>
		{/if}

		<Button type="submit" class="w-full sm:w-auto" loading={form.submitting}>Next</Button>
	</StepLayout>
</form>
