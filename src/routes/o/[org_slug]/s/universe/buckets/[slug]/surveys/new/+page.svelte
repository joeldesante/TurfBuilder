<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import CreateSurveyPage from '$pages/universe/buckets/surveys/new/CreateSurveyPage.svelte';

	const { data } = $props();

	async function handleCreate(name: string) {
		const res = await fetch(`/o/${data.organization.slug}/s/api/surveys`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name, bucketId: data.bucket.id })
		});
		if (!res.ok) {
			const { error } = await res.json().catch(() => ({ error: 'Failed to create survey.' }));
			throw new Error(error);
		}
		const { id } = await res.json();
		await invalidateAll();
		goto(`/o/${data.organization.slug}/s/universe/buckets/${data.bucket.slug}/surveys/${id}`);
	}
</script>

<CreateSurveyPage onCreate={handleCreate} />
