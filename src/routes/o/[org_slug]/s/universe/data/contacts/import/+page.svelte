<script lang="ts">
	import ImportContactsPage from '$pages/o/s/universe/data/contacts/import/ImportContactsPage.svelte';

	import { goto, invalidate, replaceState } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { IMPORTS_KEY } from '$lib/shared/utils/import-state';
	import { api, ApiError, errorMessage } from '$lib/client/api';
	import { indexCsvFile } from '$lib/client/csv-index';
	import { putFile } from '$lib/client/upload';

	import type { ColumnMapping } from '$lib/shared/utils/csv-mapping';
	import type { ContactImportFile, ContactImportRowIndex } from '$lib/shared/types/contact-imports';

	import { importStateParams, type ImportViewState } from '$lib/shared/utils/import-state';

	const { data } = $props();

	/** Keeps the place in the importer in the address, so a reload picks up there. No history entries are added. */
	function handleStateChange(state: ImportViewState | null) {
		const url = new URL(location.href);
		url.search = importStateParams(state, url.searchParams).toString();
		if (url.href === location.href) return;
		try {
			replaceState(url, {});
		} catch {
			// The router is not ready yet; the next change will set it.
		}
	}

	/**
	 * Takes an uploaded file off the list. The file itself stays in storage. Nothing is
	 * reloaded: the page has already taken the row off the screen, and a reload would only
	 * re-run every query behind the page to confirm what the person has just seen.
	 */
	async function handleArchiveImport(file: ContactImportFile) {
		await api(`/contact-imports/${file.id}`, { method: 'DELETE' });
	}

	/** A short-lived link to read an already uploaded file from, and where its rows start. */
	async function handleLoadImport(file: ContactImportFile) {
		const { url, row_index } = await api<{ url: string; row_index: ContactImportRowIndex | null }>(
			`/contact-imports/${file.id}/download`
		);
		return { url, rowIndex: row_index };
	}

	/**
	 * Starts the import. The server saves the job first and then calls the import function, so
	 * by the time this resolves there is a job to watch. Then the page moves to the active
	 * imports page. A file that is already being imported, or an import that could not be
	 * started (its job is saved as failed), goes there too, since there is something to see.
	 */
	async function handleBeginImport(input: {
		importId: string;
		schemaId: string;
		mapping: ColumnMapping;
	}) {
		try {
			await api(`/contact-imports/${input.importId}/jobs`, {
				method: 'POST',
				body: { schemaId: input.schemaId, mapping: input.mapping }
			});
		} catch (e) {
			toast.error(errorMessage(e, 'The import could not be started.'));
			if (!(e instanceof ApiError) || (e.status !== 409 && e.status !== 503)) return;
		}
		await goto(`/o/${data.organization.slug}/s/universe/data/contacts/import/active`);
	}

	/**
	 * Asks the server for a short-lived upload link, sends the CSV straight to the
	 * storage bucket (the file never passes through the web server), then counts
	 * its rows, notes where every thousandth starts, and tells the server it is done,
	 * which adds it to the list.
	 */
	async function handleUpload(file: File, onProgress: (percent: number) => void) {
		const { id, url } = await api<{ id: string; url: string; key: string }>(
			`/organizations/${data.organization.id}/contact-imports`,
			{ method: 'POST', body: { fileName: file.name, contentLength: file.size } }
		);
		await putFile(url, file, 'text/csv', onProgress);
		const index = await indexCsvFile(file);
		await api(`/contact-imports/${id}`, {
			method: 'PATCH',
			body: {
				rowCount: index.rowCount,
				rowIndex: { interval: index.interval, offsets: index.offsets }
			}
		});
		// Only the list of files is read again, not the layouts and everything else on the page.
		await invalidate(IMPORTS_KEY);
		// The page reads rows of the file from the index, so it does not fetch them back, and
		// keeps the import's id in the address.
		return { importId: id, index };
	}
</script>

<svelte:head>
	<title>Import Contacts | {data.config?.application_name ?? 'TurfBuilder'}</title>
</svelte:head>

<ImportContactsPage
	orgSlug={data.organization.slug}
	available={data.available}
	schemas={data.schemas}
	imports={data.imports}
	restore={data.restore}
	onStateChange={handleStateChange}
	onUpload={handleUpload}
	onLoadImport={handleLoadImport}
	onBeginImport={handleBeginImport}
	onArchiveImport={handleArchiveImport}
/>
