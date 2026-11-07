<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { signOut } from '$lib/client/sign-out';
	import { api } from '$lib/client/api';
	import JoinTurf from '$pages/o/join/JoinTurf.svelte';

	const { data } = $props();
	const orgSlug = $derived($page.params.org_slug);

	async function handleJoin(code: string) {
		const turf = await api<{ id: string }>(
			`/organizations/${data.organization.id}/turf-memberships`,
			{ method: 'POST', body: { code } }
		);
		goto(`/o/${orgSlug}/map/${turf.id}`);
	}
</script>

<JoinTurf onJoin={handleJoin} name={data.user.name} email={data.user.email} onsignout={signOut} />
