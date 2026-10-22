<script lang="ts">
	import { goto } from '$app/navigation';
	import InfraEmailLogPage from '$pages/infra/settings/InfraEmailLogPage.svelte';
	import type { EmailLogFilters } from '$lib/shared/types/activity';

	const { data } = $props();

	function onfilter(filters: EmailLogFilters) {
		const params = new URLSearchParams();
		for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
		goto(`?${params}`, { keepFocus: true, noScroll: true });
	}
</script>

<svelte:head><title>Email log | Infrastructure</title></svelte:head>

<InfraEmailLogPage page={data.page} filters={data.filters} templates={data.templates} {onfilter} />
