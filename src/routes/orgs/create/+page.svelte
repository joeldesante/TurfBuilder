<script lang="ts">
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/client';
	import CreateOrg from '$pages/orgs/create/CreateOrg.svelte';

	async function handleCreate(name: string, slug: string) {
		const result = await authClient.organization.create({ name, slug });
		if (result.error) {
			throw new Error(result.error.message ?? 'Failed to create organization.');
		}
		if (result.data) {
			await authClient.organization.setActive({ organizationId: result.data.id });
			goto(`/o/${result.data.slug}/s/`);
		}
	}
</script>

<svelte:head>
	<title>Create Organization</title>
</svelte:head>

<CreateOrg onCreate={handleCreate} />
