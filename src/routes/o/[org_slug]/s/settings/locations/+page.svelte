<script lang="ts">
	import LocationDataPage from '$pages/o/s/settings/locations/LocationDataPage.svelte';
	import { page } from '$app/stores';
	const { data } = $props();
</script>

<LocationDataPage count={data.count} org_slug={$page.params.org_slug} />
