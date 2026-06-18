<script lang="ts">
	import { page } from '$app/stores';
	import SignIn from '$pages/auth/signin/SignIn.svelte';

	const { data } = $props();
	const redirectTo = $derived($page.url.searchParams.get('redirectTo') ?? '/');
</script>

<svelte:head>
	<title>Sign In | {data.config?.application_name ?? 'TurfBuilder'}</title>
</svelte:head>

<SignIn {redirectTo} />
