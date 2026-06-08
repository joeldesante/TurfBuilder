<script lang="ts">
	import ForgotPassword from '$pages/auth/ForgotPassword.svelte';

	const { data } = $props();
</script>

<svelte:head>
	<title>Forgot Password | {data.config?.application_name ?? 'TurfBuilder'}</title>
</svelte:head>

<ForgotPassword />
