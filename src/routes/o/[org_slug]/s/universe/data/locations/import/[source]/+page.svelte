<script lang="ts">
	import UniverseDataLocationsImportPage from '$pages/o/s/universe/data/locations/import/UniverseDataLocationsImportPage.svelte';
	import type {
		ImportResult,
		ImportSource
	} from '$pages/o/s/universe/data/locations/import/UniverseDataLocationsImportPage.svelte';

	import { api } from '$lib/client/api';

	const { data } = $props();

	const validSources: ImportSource[] = ['csv', 'google-sheets'];
	const source = validSources.includes(data.source as ImportSource)
		? (data.source as ImportSource)
		: 'csv';

	async function handleImportCsv(file: File): Promise<ImportResult> {
		const formData = new FormData();
		formData.append('file', file);

		return api<ImportResult>(`/organizations/${data.organization.id}/location-imports`, {
			method: 'POST',
			body: formData
		});
	}
</script>

<UniverseDataLocationsImportPage
	orgSlug={data.orgSlug}
	{source}
	onImportCsv={source === 'csv' ? handleImportCsv : undefined}
/>
