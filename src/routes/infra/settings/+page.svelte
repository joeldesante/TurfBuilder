<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import InfraSettingsPage from '$pages/infra/settings/InfraSettingsPage.svelte';

	const { data } = $props();

	async function save(key: string, value: string) {
		const res = await fetch('/infra/settings/api', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ key, value })
		});
		if (!res.ok) {
			const body = await res.json().catch(() => ({}));
			throw new Error(body.error ?? 'Failed to save setting.');
		}
		await invalidateAll();
	}

	const onToggle = (key: string, value: boolean) => save(key, String(value));
	const onSave = (key: string, value: string) => save(key, value);
</script>

<InfraSettingsPage settings={data.settings} {onToggle} {onSave} />
