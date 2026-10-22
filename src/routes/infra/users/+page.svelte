<script lang="ts">
	import { goto } from '$app/navigation';
	import InfraUsersPage from '$pages/infra/users/InfraUsersPage.svelte';
	import type { UserFilters } from '$lib/shared/types/platform-users';

	const { data } = $props();

	function onfilter(filters: UserFilters) {
		const params = new URLSearchParams();
		for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
		goto(`?${params}`, { keepFocus: true, noScroll: true });
	}
</script>

<svelte:head><title>Users | Infrastructure</title></svelte:head>

<InfraUsersPage page={data.page} filters={data.filters} {onfilter} />
