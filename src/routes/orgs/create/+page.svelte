<script lang="ts">
	import { goto } from '$app/navigation';
	import { api } from '$lib/client/api';
	import type { OrganizationSlugAvailability } from '$lib/shared/types/organizations';
	import CreateOrg from '$pages/orgs/create/CreateOrg.svelte';

	// ApiError messages are written to be shown, and the form displays whatever is thrown.
	async function handleCreate(name: string, slug: string) {
		const created = await api<{ slug: string }>('/organizations', {
			method: 'POST',
			body: { name, slug }
		});
		goto(`/o/${created.slug}/s/`);
	}

	async function checkSlug(slug: string) {
		const result = await api<OrganizationSlugAvailability>(
			`/organization-slugs/${encodeURIComponent(slug)}`
		);
		return result.available;
	}
</script>

<svelte:head>
	<title>Create Organization</title>
</svelte:head>

<CreateOrg onCreate={handleCreate} {checkSlug} />
