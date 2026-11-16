<script lang="ts">
	import ActiveImportsPage from '$pages/o/s/universe/data/contacts/import/active/ActiveImportsPage.svelte';
	import { api } from '$lib/client/api';
	import type { ContactImportJob } from '$lib/shared/types/contact-imports';

	const { data } = $props();

	/** Reads the jobs again, for the page to show new progress. */
	function handleRefresh() {
		return api<ContactImportJob[]>(`/organizations/${data.organization.id}/contact-import-jobs`);
	}
</script>

<svelte:head>
	<title>Active Imports | {data.config?.application_name ?? 'TurfBuilder'}</title>
</svelte:head>

<ActiveImportsPage orgSlug={data.organization.slug} jobs={data.jobs} onRefresh={handleRefresh} />
