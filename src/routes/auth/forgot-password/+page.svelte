<script lang="ts">
	import ForgotPassword from '$pages/auth/forgot-password/ForgotPassword.svelte';

	const { data } = $props();
</script>

<svelte:head>
	<title>Forgot Password | {data.config?.application_name ?? 'TurfBuilder'}</title>
</svelte:head>

<ForgotPassword />
