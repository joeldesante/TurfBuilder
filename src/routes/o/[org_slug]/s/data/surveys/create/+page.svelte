<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import CreateSurvey from '$pages/system/data/surveys/create/CreateSurvey.svelte';

	const orgSlug = $derived($page.params.org_slug);
	const surveysHref = $derived(`/o/${orgSlug}/s/data/surveys`);

	async function handleCreate(name: string) {
		const res = await fetch(`/o/${orgSlug}/s/api/surveys`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name })
		});
		if (!res.ok) throw new Error('Failed to create survey.');
		const { id } = await res.json();
		goto(`/o/${orgSlug}/s/data/surveys/${id}/edit`);
	}
</script>

<CreateSurvey {surveysHref} onCreate={handleCreate} />
