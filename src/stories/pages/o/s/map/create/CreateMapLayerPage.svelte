<script lang="ts">
	import Button from '$components/actions/button/Button.svelte';
	import FormField from '$components/data-inputs/form-field/FormField.svelte';
	import TextInput from '$components/data-inputs/text-input/TextInput.svelte';
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';
	import { Form } from '$lib/client/formstorm/form.svelte';
	import { z } from 'zod';

	interface Props {
		onCreate: (data: { layerName: string; geojson: File }) => Promise<void>;
	}

	const { onCreate }: Props = $props();

	const schema = z.object({
		layerName: z.string().min(1, 'Layer name is required'),
		geojson: z.custom<File | null>((value) => value instanceof File, {
			message: 'A GeoJSON file is required'
		})
	});

	const form = new Form(schema, async (values) => {
		await onCreate({ layerName: values.layerName.trim(), geojson: values.geojson as File });
	});

	function handleFileChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		form.values.geojson = input.files?.[0] ?? null;
		form.touch('geojson');
	}
</script>

<div>
	<PageHeader title="Create a Custom Layer" />

	<form
		onsubmit={(e) => {
			e.preventDefault();
			form.submit();
		}}
		class="flex w-full max-w-sm flex-col gap-6"
	>
		<FormField
			label="Layer Name"
			id="layer-name"
			errors={form.touched.layerName ? (form.errors.layerName ?? []) : []}
			dirty={form.touched.layerName}
		>
			<TextInput
				bind:value={form.values.layerName}
				placeholder="e.g. District Boundaries"
				onfocusout={() => form.touch('layerName')}
			/>
		</FormField>

		<FormField
			label="GeoJSON"
			id="geojson"
			errors={form.touched.geojson ? (form.errors.geojson ?? []) : []}
			dirty={form.touched.geojson}
		>
			<input
				id="geojson"
				type="file"
				accept=".geojson,.json,application/geo+json,application/json"
				onchange={handleFileChange}
				class="border-outline text-on-surface w-full rounded-sm border px-3 py-2 text-base file:mr-3"
			/>
		</FormField>

		<div>
			<Button type="submit" loading={form.submitting}>
				{form.submitting ? 'Creating…' : 'Create'}
			</Button>
		</div>

		{#if form.errorMessage}
			<p class="text-error text-sm">{form.errorMessage}</p>
		{/if}
	</form>
</div>
