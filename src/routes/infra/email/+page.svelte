<script lang="ts">
	import InfraEmailPage from '$pages/infra/email/InfraEmailPage.svelte';
	const { data } = $props();

	async function onSave(key: string, value: string) {
		const res = await fetch('/infra/email/api', {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ key, value })
		});
		if (!res.ok) {
			const data = await res.json().catch(() => ({}));
			throw new Error(data.message ?? 'Failed to save setting.');
		}
	}
</script>

<InfraEmailPage settings={data.settings} {onSave} />
