<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import UniverseDataContactsPage from '$pages/o/s/universe/data/contacts/UniverseDataContactsPage.svelte';
	import { toast } from 'svelte-sonner';
	import { api, errorMessage } from '$lib/client/api';
	import type { FilterGroup } from '$lib/shared/types/filters';

	const { data } = $props();

	/** Loads the page again with a new search and filters, keeping the tab and view. Back to page 1. */
	async function handleFilter(next: { search: string; filters: FilterGroup | null }) {
		const params = new URLSearchParams();
		if (data.selected) params.set('schema', data.selected.id);
		if (data.view === 'map') params.set('view', 'map');
		if (next.search) params.set('q', next.search);
		if (next.filters && next.filters.filters.length > 0) {
			params.set('filters', JSON.stringify(next.filters));
		}
		const query = params.toString();
		await goto(`/o/${data.organization.slug}/s/universe/data/contacts${query ? `?${query}` : ''}`, {
			keepFocus: true
		});
	}

	async function handleImport() {
		await goto(
			resolve('/o/[org_slug]/s/universe/data/contacts/import', {
				org_slug: data.organization.slug
			})
		);
	}

	async function handleReorder(ids: string[]) {
		try {
			await api(`/organizations/${data.organization.id}/contact-schema-order`, {
				method: 'PUT',
				body: { ids }
			});
			await invalidateAll();
		} catch (e) {
			toast.error(errorMessage(e, 'The tab order could not be saved.'));
			await invalidateAll();
			// Tells the page to put the tabs back to the saved order.
			throw e;
		}
	}
</script>

<svelte:head>
	<title>Contacts | {data.config?.application_name ?? 'TurfBuilder'}</title>
</svelte:head>

<UniverseDataContactsPage
	orgSlug={data.organization.slug}
	orgId={data.organization.id}
	search={data.search}
	filters={data.filters}
	onFilter={handleFilter}
	schemas={data.schemas}
	selected={data.selected}
	view={data.view}
	markers={data.markers}
	contacts={data.contacts}
	totalCount={data.totalCount}
	page={data.page}
	pageSize={data.pageSize}
	onReorder={handleReorder}
	onImport={handleImport}
/>
