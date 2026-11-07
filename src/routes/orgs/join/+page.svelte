<script lang="ts">
	import { signOut } from '$lib/client/sign-out';
	import JoinOrg from '$pages/orgs/join/JoinOrg.svelte';

	const { data } = $props();
</script>

<svelte:head>
	<title>Join an Organization</title>
</svelte:head>

<JoinOrg name={data.user.name} email={data.user.email} onsignout={signOut} />
