<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import InfraSettingsPage from '$pages/infra/settings/InfraSettingsPage.svelte';

	const { data } = $props();

	async function onToggle(key: string, value: boolean) {
		const res = await fetch('/infra/settings/api', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ key, value: String(value) })
		});
		if (!res.ok) {
			const body = await res.json().catch(() => ({}));
			throw new Error(body.error ?? 'Failed to save setting.');
		}
		await invalidateAll();
	}
</script>

<InfraSettingsPage settings={data.settings} {onToggle} />
