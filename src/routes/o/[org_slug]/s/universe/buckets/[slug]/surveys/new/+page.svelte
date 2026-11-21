<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import CreateSurveyPage from '$pages/o/s/universe/buckets/surveys/new/CreateSurveyPage.svelte';
	import { api } from '$lib/client/api';

	const { data } = $props();

	async function handleCreate(name: string) {
		const { id } = await api<{ id: string }>(`/buckets/${data.bucket.id}/surveys`, {
			method: 'POST',
			body: { name }
		});
		await invalidateAll();
		goto(`/o/${data.organization.slug}/s/universe/buckets/${data.bucket.slug}/surveys/${id}`);
	}
</script>

<CreateSurveyPage onCreate={handleCreate} />
