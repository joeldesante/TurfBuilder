<script lang="ts">
	import BucketScriptEditorPage from '$pages/o/s/universe/buckets/scripts/BucketScriptEditorPage.svelte';
	import { api } from '$lib/client/api';

	const { data } = $props();

	async function handleSave(content: string) {
		await api(`/scripts/${data.script.id}`, { method: 'PATCH', body: { contents: content } });
	}
</script>

<BucketScriptEditorPage
	scriptName={data.script.name}
	bucketName={data.bucket.name}
	initialContent={data.script.contents}
	onSave={handleSave}
/>
