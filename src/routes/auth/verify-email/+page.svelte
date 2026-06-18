<script lang="ts">
	import VerifyEmail from '$pages/auth/verify-email/VerifyEmail.svelte';

	const { data } = $props();
</script>

<VerifyEmail email={data.email} />
