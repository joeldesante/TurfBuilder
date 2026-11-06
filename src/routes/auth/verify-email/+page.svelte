<script lang="ts">
	import { navigateWithLoader } from '$lib/client/navigate-with-loader';
	import VerifyEmail from '$pages/auth/verify-email/VerifyEmail.svelte';

	const { data } = $props();

	// Cover the page before leaving, so the organizations load in under the fade. The org picker
	// takes the loader over and puts it away once its list has arrived.
	const openOrganizations = () => navigateWithLoader('/orgs');
</script>

<VerifyEmail email={data.email} onBack={openOrganizations} />
