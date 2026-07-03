<script lang="ts">
	import UniverseDataLocationsImportPage from '$pages/o/s/universe/data/locations/import/UniverseDataLocationsImportPage.svelte';
	import type {
		ImportResult,
		ImportSource
	} from '$pages/o/s/universe/data/locations/import/UniverseDataLocationsImportPage.svelte';

	const { data } = $props();

	const validSources: ImportSource[] = ['csv', 'google-sheets'];
	const source = validSources.includes(data.source as ImportSource)
		? (data.source as ImportSource)
		: 'csv';

	async function handleImportCsv(file: File): Promise<ImportResult> {
		const orgSlug = data.orgSlug;
		const formData = new FormData();
		formData.append('file', file);

		const response = await fetch(`/o/${orgSlug}/s/api/universe/locations/import`, {
			method: 'POST',
			body: formData
		});

		if (!response.ok) {
			const body = await response.json().catch(() => null);
			throw new Error(body?.error ?? 'Failed to import file.');
		}

		return response.json();
	}
</script>

<UniverseDataLocationsImportPage
	orgSlug={data.orgSlug}
	{source}
	onImportCsv={source === 'csv' ? handleImportCsv : undefined}
/>
