<script lang="ts">
	import PluginsPage from '$pages/plugins/PluginsPage.svelte';

	const { data } = $props();

	async function handleToggle(slug: string, enabled: boolean) {
		const endpoint = enabled ? 'install' : 'uninstall';
		const res = await fetch(
			`/o/${data.organization.slug}/s/api/plugins/${slug}/${endpoint}`,
			{ method: 'POST' }
		);
		if (!res.ok) throw new Error(await res.text());
		location.reload();
	}
</script>

<PluginsPage plugins={data.plugins} onToggle={handleToggle} />
