<script lang="ts">
	import { page } from '$app/stores';
	import Signup from '$pages/auth/signup/Signup.svelte';

	let { data } = $props();
	const redirectTo = $derived($page.url.searchParams.get('redirectTo') ?? '/');
</script>

<svelte:head>
	<title>Sign Up | {data.config?.application_name ?? 'TurfBuilder'}</title>
</svelte:head>
<Signup {data} {redirectTo} />
