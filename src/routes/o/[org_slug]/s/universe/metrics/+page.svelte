<script lang="ts">
	import UniverseMetricsPage from '$pages/o/s/universe/metrics/UniverseMetricsPage.svelte';
	import { page } from '$app/state';
	const { data } = $props();
</script>

<UniverseMetricsPage orgSlug={page.params.org_slug!} buckets={data.buckets} />
