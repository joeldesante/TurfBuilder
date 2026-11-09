<script lang="ts">
	import UniverseDataManagerPage from '$pages/o/s/universe/manage/UniverseDataManagerPage.svelte';
	import type { ImportResult } from '$pages/o/s/universe/manage/UniverseDataManagerPage.svelte';
	import { invalidateAll } from '$app/navigation';
	import { api } from '$lib/client/api';

	const { data } = $props();

	async function importPeople(file: File): Promise<ImportResult> {
		const form = new FormData();
		form.set('file', file);
		const result = await api<ImportResult>(
			`/organizations/${data.organization.id}/people-imports`,
			{
				method: 'POST',
				body: form
			}
		);
		await invalidateAll();
		return result;
	}

	async function importLocations(file: File): Promise<ImportResult> {
		const form = new FormData();
		form.set('file', file);
		const result = await api<ImportResult>(
			`/organizations/${data.organization.id}/location-imports`,
			{ method: 'POST', body: form }
		);
		await invalidateAll();
		return result;
	}
</script>

<UniverseDataManagerPage onImportPeople={importPeople} onImportLocations={importLocations} />
