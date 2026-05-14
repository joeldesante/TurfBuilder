<script lang="ts">
	import VerifyEmail from '$pages/auth/VerifyEmail.svelte';

	const { data } = $props();
</script>

<VerifyEmail email={data.email} />
