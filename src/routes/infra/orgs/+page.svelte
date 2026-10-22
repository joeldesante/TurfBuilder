<script lang="ts">
	import { goto } from '$app/navigation';
	import InfraOrgsPage from '$pages/infra/orgs/InfraOrgsPage.svelte';
	import type { OrgFilters } from '$lib/shared/types/platform-organizations';

	const { data } = $props();

	function onfilter(filters: OrgFilters) {
		const params = new URLSearchParams();
		for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
		goto(`?${params}`, { keepFocus: true, noScroll: true });
	}
</script>

<svelte:head><title>Organizations | Infrastructure</title></svelte:head>

<InfraOrgsPage page={data.page} filters={data.filters} {onfilter} />
