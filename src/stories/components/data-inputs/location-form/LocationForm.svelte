<script lang="ts" module>
	export interface Props {
		/** Existing values for an edit flow. Omit to author a new location. */
		initialValues?: Partial<LocationFields>;
		/**
		 * Pin position. Kept as a prop rather than a form field so a parent map
		 * can move the pin while the form is open and have it follow.
		 */
		coordinates: { latitude: number; longitude: number };
		submitLabel?: string;
		cancelLabel?: string;
		/** Copy shown above the fields, e.g. field instructions for volunteers. */
		instructions?: string;
		/** Enables photo attachment. Omit to hide the uploader entirely. */
		orgSlug?: string;
		maxPhotos?: number;
		onSubmit: (fields: LocationFields) => Promise<void>;
		onCancel?: () => void;
		/** Extra controls rendered above the buttons. */
		children?: Snippet;
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Form } from '$lib/client/formstorm/form.svelte';
	import {
		LocationFormSchema,
		locationFormToFields,
		locationFieldsToForm,
		type LocationFields
	} from '$lib/schemas/location';
	import FormField from '$components/data-inputs/form-field/FormField.svelte';
	import TextInput from '$components/data-inputs/text-input/TextInput.svelte';
	import PhotoUpload from '$components/data-inputs/photo-upload/PhotoUpload.svelte';
	import Button from '$components/actions/button/Button.svelte';

	const {
		initialValues,
		coordinates,
		submitLabel = 'Add location',
		cancelLabel = 'Cancel',
		instructions,
		orgSlug,
		maxPhotos = 3,
		onSubmit,
		onCancel,
		children
	}: Props = $props();

	const form = new Form(
		LocationFormSchema,
		async (values) => {
			await onSubmit(locationFormToFields(values));
		},
		locationFieldsToForm({ ...initialValues, ...coordinates })
	);

	// The pin is authoritative for position: dragging it while the form is open
	// updates the values that will be submitted.
	$effect(() => {
		form.values.latitude = coordinates.latitude;
		form.values.longitude = coordinates.longitude;
	});

	function errorsFor(field: keyof typeof form.values) {
		return form.touched[field] ? (form.errors[field] ?? []) : [];
	}
</script>

<form
	class="flex flex-col gap-4"
	onsubmit={(e) => {
		e.preventDefault();
		form.submit();
	}}
>
	{#if instructions}
		<p class="text-sm text-on-surface-variant">{instructions}</p>
	{/if}

	<FormField label="Business name" errors={errorsFor('name')} dirty={form.dirty}>
		<TextInput bind:value={form.values.name} onfocusout={() => form.touch('name')} />
	</FormField>

	<FormField label="Street address" errors={errorsFor('address_line_1')} dirty={form.dirty}>
		<TextInput
			bind:value={form.values.address_line_1}
			onfocusout={() => form.touch('address_line_1')}
		/>
	</FormField>

	<FormField
		label="Unit or suite"
		requirementIndicator="optional"
		errors={errorsFor('address_line_2')}
		dirty={form.dirty}
	>
		<TextInput
			bind:value={form.values.address_line_2}
			onfocusout={() => form.touch('address_line_2')}
		/>
	</FormField>

	<div class="grid grid-cols-2 gap-4">
		<FormField label="City" errors={errorsFor('city')} dirty={form.dirty}>
			<TextInput bind:value={form.values.city} onfocusout={() => form.touch('city')} />
		</FormField>

		<FormField label="State or region" errors={errorsFor('state_or_region')} dirty={form.dirty}>
			<TextInput
				bind:value={form.values.state_or_region}
				onfocusout={() => form.touch('state_or_region')}
			/>
		</FormField>
	</div>

	<div class="grid grid-cols-2 gap-4">
		<FormField label="Postal code" errors={errorsFor('postal_code')} dirty={form.dirty}>
			<TextInput
				bind:value={form.values.postal_code}
				onfocusout={() => form.touch('postal_code')}
			/>
		</FormField>

		<FormField
			label="Country"
			helperText="Two-letter code"
			errors={errorsFor('country_code')}
			dirty={form.dirty}
		>
			<TextInput
				bind:value={form.values.country_code}
				onfocusout={() => form.touch('country_code')}
			/>
		</FormField>
	</div>

	{#if orgSlug}
		<PhotoUpload {orgSlug} bind:keys={form.values.photo_keys} max={maxPhotos} />
	{/if}

	{#if children}
		{@render children()}
	{/if}

	<p class="text-xs text-on-surface-subtle" data-testid="location-form-coordinates">
		Pin at {coordinates.latitude.toFixed(5)}, {coordinates.longitude.toFixed(5)}
	</p>

	{#if form.errorMessage}
		<p role="alert" class="text-sm text-error">{form.errorMessage}</p>
	{/if}

	<div class="flex justify-end gap-2">
		{#if onCancel}
			<Button variant="ghost" type="button" onclick={onCancel} disabled={form.submitting}>
				{cancelLabel}
			</Button>
		{/if}
		<Button variant="primary" type="submit" loading={form.submitting}>{submitLabel}</Button>
	</div>
</form>
