<script lang="ts">
	import { navigateWithLoader } from '$lib/client/navigate-with-loader';
	import { signOut } from '$lib/client/sign-out';
	import OrgPicker from '$pages/orgs/OrgPicker.svelte';

	const { data } = $props();

	// The loader is the root layout's, so it fades out over the org's page once that has rendered.
	const handleSelect = (org: { id: string; slug: string }) => navigateWithLoader(`/o/${org.slug}/`);
</script>

<svelte:head>
	<title>Select Organization</title>
</svelte:head>

<OrgPicker
	allowCreation={data.allowCreation}
	name={data.user.name}
	email={data.user.email}
	onsignout={signOut}
	onSelect={handleSelect}
/>
