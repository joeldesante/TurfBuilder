<script lang="ts">
	import StaffDashboardPage from '$pages/o/s/dashboard/StaffDashboardPage.svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { parseRange } from '$lib/dashboard-range';
	const { data } = $props();

	// ?bucket=<slug> selects a bucket so a shared link shows the same view.
	// No param means the entire universe.
	const bucketSlug = $derived(page.url.searchParams.get('bucket'));

	// ?range=7d|30d; no param means all time.
	const range = $derived(parseRange(page.url.searchParams.get('range')));

	// Sets or clears one param. goto, not pushState: the server load reads the
	// params, so it has to run again.
	function setParam(name: string, value: string | null) {
		const url = new URL(page.url);
		if (value) url.searchParams.set(name, value);
		else url.searchParams.delete(name);
		goto(url, { keepFocus: true, noScroll: true });
	}
</script>

<svelte:head>
	<title>Dashboard | {data.config?.application_name ?? 'TurfBuilder'}</title>
</svelte:head>

<StaffDashboardPage
	orgSlug={data.organization.slug}
	buckets={data.buckets.map(({ id, slug, name }) => ({ id, slug, name }))}
	{bucketSlug}
	progress={data.progress}
	mapPoints={data.points}
	onBucketChange={(slug) => setParam('bucket', slug)}
	{range}
	onRangeChange={(r) => setParam('range', r === 'all' ? null : r)}
/>
