<script lang="ts">
	import BucketScriptEditorPage from '$pages/universe/buckets/scripts/BucketScriptEditorPage.svelte';

	const { data } = $props();

	async function handleSave(content: string) {
		const res = await fetch(
			`/o/${data.organization.slug}/s/api/scripts/${data.script.id}`,
			{
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ contents: content })
			}
		);
		if (!res.ok) {
			const { error } = await res.json().catch(() => ({ error: 'Failed to save.' }));
			throw new Error(error);
		}
	}
</script>

<BucketScriptEditorPage
	scriptName={data.script.name}
	bucketName={data.bucket.name}
	initialContent={data.script.contents}
	onSave={handleSave}
/>
