<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { ApiError, api } from '$lib/client/api';
	import InfraSettingsPage, { type SaveResult } from '$pages/infra/settings/InfraSettingsPage.svelte';

	const { data } = $props();

	async function onsave(values: Record<string, string>): Promise<SaveResult> {
		try {
			const result = await api<{ restartRequired: boolean }>('/system-settings', { method: 'PATCH', body: values });
			await invalidateAll();
			return { ok: true, restartRequired: result.restartRequired };
		} catch (e) {
			if (e instanceof ApiError) return { ok: false, message: e.message, errors: e.errors ?? {} };
			return { ok: false, message: 'The settings could not be saved.', errors: {} };
		}
	}

	async function ontestmail() {
		const { to } = await api<{ to: string }>('/mail-tests', { method: 'POST' });
		return `Sent a test email to ${to}.`;
	}

	async function onteststorage() {
		await api('/storage-tests', { method: 'POST' });
		return 'The bucket accepted a test file.';
	}
</script>

<svelte:head><title>Settings | Infrastructure</title></svelte:head>

<InfraSettingsPage settings={data.settings} tab={data.tab} credentials={data.credentials} {onsave} {ontestmail} {onteststorage} />
