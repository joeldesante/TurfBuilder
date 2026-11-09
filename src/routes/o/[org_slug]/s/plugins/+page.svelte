<script lang="ts">
	import PluginsPage from '$pages/o/s/plugins/PluginsPage.svelte';
	import { api } from '$lib/client/api';

	const { data } = $props();

	async function handleToggle(slug: string, enabled: boolean) {
		await api(`/organizations/${data.organization.id}/plugins/${encodeURIComponent(slug)}`, {
			method: enabled ? 'PUT' : 'DELETE'
		});
		// Reload to reflect the change in nav and plugin list
		location.reload();
	}
</script>

<PluginsPage plugins={[]} onToggle={handleToggle} />
