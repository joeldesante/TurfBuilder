<script lang="ts">
	import UniverseMetricsPage from '$pages/o/s/universe/metrics/UniverseMetricsPage.svelte';
	const { data } = $props();
</script>

<UniverseMetricsPage buckets={data.buckets} />
