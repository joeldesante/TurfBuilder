<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import LocationSuggestionsPage from '$pages/o/s/universe/data/locations/LocationSuggestionsPage.svelte';

	const { data } = $props();

	const base = $derived(`/o/${data.organization.slug}/s/api/universe/locations/suggestions`);

	/** Throws the server's message so the page surfaces it verbatim. */
	async function send(url: string) {
		const res = await fetch(url, { method: 'POST' });
		if (!res.ok) {
			const { error } = await res.json().catch(() => ({ error: 'Request failed.' }));
			throw new Error(error);
		}
		await invalidateAll();
	}

	async function handleApprove(id: string) {
		await send(`${base}/${id}/approve`);
	}

	async function handleReject(id: string) {
		await send(`${base}/${id}/reject`);
	}

	const editsBase = $derived(`/o/${data.organization.slug}/s/api/universe/locations/edits`);

	async function handleApproveEdit(id: string) {
		await send(`${editsBase}/${id}/approve`);
	}

	async function handleRejectEdit(id: string) {
		await send(`${editsBase}/${id}/reject`);
	}
</script>

<LocationSuggestionsPage
	orgSlug={data.organization.slug}
	suggestions={data.suggestions}
	edits={data.edits}
	canApprove={data.canApprove}
	canReject={data.canReject}
	canReviewEdits={data.canReviewEdits}
	onApprove={handleApprove}
	onReject={handleReject}
	onApproveEdit={handleApproveEdit}
	onRejectEdit={handleRejectEdit}
/>
