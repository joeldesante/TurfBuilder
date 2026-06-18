<script lang="ts">
	import { page } from '$app/stores';
	import ResetPassword from '$pages/auth/reset-password/ResetPassword.svelte';

	const { data } = $props();
	const token = $derived($page.url.searchParams.get('token') ?? '');
</script>

<svelte:head>
	<title>Reset Password | {data.config?.application_name ?? 'TurfBuilder'}</title>
</svelte:head>

<ResetPassword {token} />
