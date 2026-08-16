<script lang="ts">
	import UniverseDataManagerPage from '$pages/o/s/universe/manage/UniverseDataManagerPage.svelte';
	import type { ImportResult } from '$pages/o/s/universe/manage/UniverseDataManagerPage.svelte';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';

	const base = $derived(`/o/${page.params.org_slug}/s/api/universe`);

	async function postImport(url: string, file: File): Promise<ImportResult> {
		const formData = new FormData();
		formData.set('file', file);
		const res = await fetch(url, { method: 'POST', body: formData });
		if (!res.ok) {
			const body = await res.text();
			let message = 'Import failed.';
			try { message = (JSON.parse(body) as { error?: string }).error ?? message; } catch { /* not JSON */ }
			throw new Error(message);
		}
		const json = await res.json();
		await invalidateAll();
		return json as ImportResult;
	}

	async function importPeople(file: File): Promise<ImportResult> {
		return postImport(`${base}/people/import`, file);
	}

	async function importLocations(file: File): Promise<ImportResult> {
		return postImport(`${base}/locations/import`, file);
	}
</script>

<UniverseDataManagerPage onImportPeople={importPeople} onImportLocations={importLocations} />
