<script lang="ts">
	import { goto } from '$app/navigation';
	import InfraAuditPage from '$pages/infra/audit/InfraAuditPage.svelte';
	import type { AuditFilters } from '$lib/shared/types/audit';

	const { data } = $props();

	function onfilter(filters: AuditFilters) {
		const params = new URLSearchParams();
		for (const [key, value] of Object.entries(filters)) if (value) params.set(key, String(value));
		goto(`?${params}`, { keepFocus: true, noScroll: true });
	}
</script>

<svelte:head><title>Audit log | Infrastructure</title></svelte:head>

<InfraAuditPage page={data.page} filters={data.filters} {onfilter} />
