<script>
	import TwoFactorSetup from "$pages/auth/2fa/setup/TwoFactorSetup.svelte";

    let { data } = $props();

</script>

<TwoFactorSetup data={data} />