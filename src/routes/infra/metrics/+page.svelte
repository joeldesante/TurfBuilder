<script lang="ts">
	import { goto } from '$app/navigation';
	import InfraMetricsPage from '$pages/infra/metrics/InfraMetricsPage.svelte';
	import type { RangeValue } from '$components/data-inputs/range-picker/RangePicker.svelte';

	const { data } = $props();

	function onrange({ range, granularity }: RangeValue) {
		goto(`?range=${range}&granularity=${granularity}`, { keepFocus: true, noScroll: true });
	}
</script>

<svelte:head><title>Metrics | Infrastructure</title></svelte:head>

<InfraMetricsPage metrics={data.metrics} {onrange} />
