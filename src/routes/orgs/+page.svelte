<script lang="ts">
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/client';
	import OrgPicker from '$pages/orgs/OrgPicker.svelte';

	const { data } = $props();

	async function handleSelect(org: { id: string; slug: string }) {
		await authClient.organization.setActive({ organizationId: org.id });
		goto(`/o/${org.slug}/s/`);
	}
</script>

<svelte:head>
	<title>Select Organization</title>
</svelte:head>

<OrgPicker orgs={data.orgs} allowCreation={data.allowCreation} onSelect={handleSelect} />
