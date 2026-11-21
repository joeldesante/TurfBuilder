<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import ContactSchemasPage from '$pages/o/s/universe/data/contact-schemas/ContactSchemasPage.svelte';
	import { toast } from 'svelte-sonner';
	import { api, errorMessage } from '$lib/client/api';

	interface SchemaInput {
		schema_name: string;
		fields: { id: string; name: string; type: string; required: boolean }[];
		identifier_field_id: string | null;
	}

	const { data } = $props();

	async function handleCreate(input: SchemaInput) {
		try {
			await api(`/organizations/${data.organization.id}/contact-schemas`, {
				method: 'POST',
				body: input
			});
		} catch (e) {
			// Shown under the form, which stays open.
			throw new Error(errorMessage(e, 'The schema could not be saved.'));
		}
		await invalidateAll();
	}

	async function handleUpdate(id: string, input: SchemaInput) {
		try {
			await api(`/contact-schemas/${id}`, { method: 'PATCH', body: input });
		} catch (e) {
			throw new Error(errorMessage(e, 'The schema could not be saved.'));
		}
		await invalidateAll();
	}

	async function handleDelete(id: string) {
		try {
			await api(`/contact-schemas/${id}`, { method: 'DELETE' });
			toast.success('Schema deleted.');
			await invalidateAll();
		} catch (e) {
			toast.error(errorMessage(e, 'The schema could not be deleted.'));
		}
	}
</script>

<svelte:head>
	<title>Contact schemas | {data.config?.application_name ?? 'TurfBuilder'}</title>
</svelte:head>

<ContactSchemasPage
	schemas={data.schemas}
	onCreate={handleCreate}
	onUpdate={handleUpdate}
	onDelete={handleDelete}
/>
