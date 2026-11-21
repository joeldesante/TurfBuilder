<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import BucketSettingsPage from '$pages/o/s/universe/buckets/settings/BucketSettingsPage.svelte';
	import { api, errorMessage } from '$lib/client/api';

	const { data } = $props();

	async function handleRename(name: string) {
		try {
			await api(`/buckets/${data.bucket.id}`, { method: 'PATCH', body: { name } });
		} catch (e) {
			throw new Error(errorMessage(e, 'The bucket could not be renamed.'));
		}
		// The sidebar and every page title read the name from the layout.
		await invalidateAll();
	}

	async function handleDelete() {
		try {
			await api(`/buckets/${data.bucket.id}`, { method: 'DELETE' });
		} catch (e) {
			throw new Error(errorMessage(e, 'The bucket could not be deleted.'));
		}
		// The bucket's own pages are gone, so leave for the dashboard.
		await goto(`/o/${data.organization.slug}/s/`, { invalidateAll: true });
	}
</script>

<svelte:head>
	<title>Settings | {data.bucket.name} | {data.config?.application_name ?? 'TurfBuilder'}</title>
</svelte:head>

<BucketSettingsPage bucketName={data.bucket.name} onRename={handleRename} onDelete={handleDelete} />
