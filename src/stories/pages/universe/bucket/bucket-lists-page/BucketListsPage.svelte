<script lang="ts">
	import PageHeader from '$components/layout/page-header/PageHeader.svelte';
	import Checkbox from '$components/data-inputs/checkbox/Checkbox.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import RowsIcon from 'phosphor-svelte/lib/Rows';
	import PlusIcon from 'phosphor-svelte/lib/Plus';
	import UsersIcon from 'phosphor-svelte/lib/Users';
	import MapPinIcon from 'phosphor-svelte/lib/MapPin';

	export interface BucketList {
		id: string;
		name: string;
		entity_type: string;
		expires_at: string;
		created_at: string;
		entry_count: number;
	}

	interface Props {
		bucketName: string;
		bucketSlug: string;
		orgSlug: string;
		lists: BucketList[];
		createHref: string;
	}

	const { bucketName, bucketSlug, orgSlug, lists, createHref }: Props = $props();

	let showExpired = $state(false);

	const now = $derived(new Date());

	const visibleLists = $derived(
		lists.filter((l) => showExpired || new Date(l.expires_at) >= now)
	);

	function formatDate(dateStr: string): string {
		const d = new Date(dateStr);
		const thisYear = new Date().getFullYear();
		return d.getFullYear() === thisYear
			? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
			: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}

	function isExpired(dateStr: string): boolean {
		return new Date(dateStr) < new Date();
	}
</script>

<PageHeader title="Lists" subheading={bucketName}>
	{#snippet actions()}
		<Button href={createHref}>
			<PlusIcon />
			New List
		</Button>
	{/snippet}
</PageHeader>

<div class="mt-4 border-t border-outline-subtle">
	<div class="flex items-center justify-between px-4 py-2">
		<div class="flex items-center gap-4 flex-1">
			<div class="w-8 shrink-0"></div>
			<span class="flex-1 text-xs font-medium text-on-surface-subtle uppercase tracking-wide">Name</span>
			<span class="text-xs font-medium text-on-surface-subtle uppercase tracking-wide w-24">Type</span>
			<span class="text-xs font-medium text-on-surface-subtle uppercase tracking-wide w-16 text-right">Entries</span>
			<span class="text-xs font-medium text-on-surface-subtle uppercase tracking-wide w-28 text-right">Expires</span>
		</div>
	</div>

	{#each visibleLists as list (list.id)}
		{@const expired = isExpired(list.expires_at)}
		<a
			href={`/o/${orgSlug}/s/universe/buckets/${bucketSlug}/lists/${list.id}`}
			class={[
				'flex items-center gap-4 px-4 py-3 border-b border-outline-subtle transition-colors duration-100 group',
				expired ? 'opacity-60 hover:bg-surface-container' : 'hover:bg-surface-container'
			].join(' ')}
		>
			<div class="w-8 h-8 shrink-0 flex items-center justify-center text-on-surface-subtle [&>svg]:size-5">
				<RowsIcon />
			</div>
			<span class="flex-1 text-sm text-on-surface truncate group-hover:text-primary transition-colors">
				{list.name}
			</span>
			<div class="w-24 flex items-center gap-1">
				{#if list.entity_type === 'people'}
					<UsersIcon class="size-3.5 text-on-surface-subtle shrink-0" />
					<span class="text-xs text-on-surface-subtle">People</span>
				{:else}
					<MapPinIcon class="size-3.5 text-on-surface-subtle shrink-0" />
					<span class="text-xs text-on-surface-subtle">Locations</span>
				{/if}
			</div>
			<span class="text-sm text-on-surface-subtle w-16 text-right tabular-nums">
				{list.entry_count.toLocaleString()}
			</span>
			<span class={['text-sm w-28 text-right tabular-nums', expired ? 'text-error' : 'text-on-surface-subtle'].join(' ')}>
				{formatDate(list.expires_at)}
			</span>
		</a>
	{:else}
		<p class="px-4 py-8 text-sm text-on-surface-subtle text-center">
			{lists.length > 0 ? 'All lists have expired.' : 'No lists yet.'}
		</p>
	{/each}
</div>

<div class="px-4 pt-3">
	<Checkbox id="show-expired" bind:checked={showExpired}>
		Show expired lists
	</Checkbox>
</div>
