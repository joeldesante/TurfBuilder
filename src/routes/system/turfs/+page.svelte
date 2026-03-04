<script lang="ts">
	import Time from 'svelte-time/Time.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import CopyButton from '$components/actions/copy-button/CopyButton.svelte';
	import PageHeader from '$components/layout/page-header/PageHeader.svelte';

	let { data } = $props();

	// Now you can access data.turfs
	//@ts-ignore
	const turfs = data.turfs;
</script>

<svelte:head>
	<title>Turfs | {data.config.application_name}</title>
</svelte:head>

<PageHeader title="Turfs">
	{#snippet actions()}
		<Button variant="primary" href="/system/turfs/cut">Cut Turfs</Button>
	{/snippet}
</PageHeader>

<div>
	<div class="grid grid-cols-3 gap-2 border-b">
		<p>Code</p>
		<p>Created</p>
		<p>Expires</p>
	</div>
	{#each turfs as turf}
		<div class="grid grid-cols-4 items-center gap-2 border-b">
			<div class="flex items-center gap-1">
				<p>{turf.code}</p>
				<CopyButton value={turf.code} aria-label="Copy turf code" />
			</div>
			<p>{turf.username}</p>
			<p><Time timestamp={turf.created_at} format="MMM DD, YYYY" /></p>
			<p><Time timestamp={turf.expires_at} format="MMM DD, YYYY" /></p>
		</div>
	{/each}
</div>
