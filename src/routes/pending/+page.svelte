<script lang="ts">
	import PendingPage from '$pages/pending/PendingPage.svelte';
	const { data } = $props();
</script>

<PendingPage user={data.user} allowCreation={data.allowCreation} />
