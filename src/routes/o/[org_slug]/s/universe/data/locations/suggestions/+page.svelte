<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import LocationSuggestionsPage from '$pages/o/s/universe/data/locations/LocationSuggestionsPage.svelte';

	import { api } from '$lib/client/api';

	const { data } = $props();

	/** Throws ApiError with the server's message, which the page shows as is. */
	async function send(path: string, method: 'PUT' | 'DELETE') {
		await api(path, { method });
		await invalidateAll();
	}

	async function handleApprove(id: string) {
		await send(`/location-suggestions/${id}/approval`, 'PUT');
	}

	async function handleReject(id: string) {
		await send(`/location-suggestions/${id}`, 'DELETE');
	}

	async function handleApproveEdit(id: string) {
		await send(`/location-edits/${id}/approval`, 'PUT');
	}

	async function handleRejectEdit(id: string) {
		await send(`/location-edits/${id}/rejection`, 'PUT');
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
