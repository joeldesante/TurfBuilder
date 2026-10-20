<script lang="ts">
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';
	import Pagination from '$components/data-display/pagination/Pagination.svelte';
	import Badge from '$components/data-display/badge/Badge.svelte';
	import TextInput from '$components/data-inputs/text-input/TextInput.svelte';
	import Select from '$components/data-inputs/select/Select.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlass';
	import { formatDate, formatDaysAgo } from '$lib/shared/utils/format-date';
	import type { Page } from '$lib/shared/utils/pagination';
	import type { OrgFilters, OrgSort, OrgStatusFilter, PlatformOrgRow } from '$lib/shared/types/platform-organizations';

	interface Props {
		page: Page<PlatformOrgRow>;
		filters: OrgFilters;
		/** Applies new filters, usually by navigating to a URL with them. */
		onfilter: (filters: OrgFilters) => void;
	}

	let { page, filters, onfilter }: Props = $props();

	let q = $state('');
	let status = $state<OrgStatusFilter>('all');
	let sort = $state<OrgSort>('newest');
	$effect.pre(() => {
		q = filters.q ?? '';
		status = filters.status ?? 'all';
		sort = filters.sort ?? 'newest';
	});

	const statusItems: { value: OrgStatusFilter; label: string }[] = [
		{ value: 'all', label: 'All organizations' },
		{ value: 'active', label: 'Active in the last 90 days' },
		{ value: 'inactive', label: 'Inactive for 90 days' },
		{ value: 'suspended', label: 'Suspended' },
		{ value: 'deleted', label: 'Deleted' }
	];

	const sortItems: { value: OrgSort; label: string }[] = [
		{ value: 'newest', label: 'Newest first' },
		{ value: 'oldest', label: 'Oldest first' },
		{ value: 'members', label: 'Most members' },
		{ value: 'recently_active', label: 'Recently active' },
		{ value: 'name', label: 'Name' }
	];

	function apply() {
		onfilter({
			q: q.trim() || undefined,
			status: status === 'all' ? undefined : status,
			sort: sort === 'newest' ? undefined : sort
		});
	}

	function pageHref(target: number) {
		const params = new URLSearchParams();
		if (filters.q) params.set('q', filters.q);
		if (filters.status && filters.status !== 'all') params.set('status', filters.status);
		if (filters.sort && filters.sort !== 'newest') params.set('sort', filters.sort);
		if (target > 1) params.set('page', String(target));
		const query = params.toString();
		return query ? `?${query}` : '?';
	}

	const filtered = $derived(Boolean(filters.q) || (filters.status && filters.status !== 'all'));
</script>

<PageHeader
	title="Organizations"
	subheading="Every organization on this instance. Open one to see who runs it, how it is used, and to act on it."
/>

<div class="space-y-4">
	<form
		role="search"
		class="flex flex-col gap-2 sm:flex-row sm:items-center"
		onsubmit={(event) => {
			event.preventDefault();
			apply();
		}}
	>
		<label class="relative flex-1">
			<span class="sr-only">Search organizations</span>
			<MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-subtle" />
			<TextInput bind:value={q} type="search" placeholder="Name or slug" class="pl-9" />
		</label>
		<div class="grid grid-cols-2 gap-2 sm:flex">
			<Select bind:value={status} items={statusItems} aria-label="Show" onchange={apply} class="sm:w-60" />
			<Select bind:value={sort} items={sortItems} aria-label="Sort" onchange={apply} class="sm:w-44" />
		</div>
		<Button type="submit" variant="outline">Search</Button>
	</form>

	{#if page.items.length === 0}
		<div class="rounded-xl border border-outline-subtle px-6 py-12 text-center">
			<p class="font-medium text-on-surface">{filtered ? 'No organizations match.' : 'No organizations yet.'}</p>
			{#if filtered}
				<Button class="mt-4" variant="outline" onclick={() => onfilter({})}>Clear filters</Button>
			{/if}
		</div>
	{:else}
		<div class="overflow-x-auto rounded-xl border border-outline-subtle">
			<table class="w-full text-sm">
				<thead class="text-left text-on-surface-subtle">
					<tr class="border-b border-outline-subtle">
						<th scope="col" class="px-4 py-2 font-medium">Organization</th>
						<th scope="col" class="hidden px-4 py-2 font-medium lg:table-cell">Owner</th>
						<th scope="col" class="px-4 py-2 text-right font-medium">Members</th>
						<th scope="col" class="hidden px-4 py-2 text-right font-medium md:table-cell">Events, 30 days</th>
						<th scope="col" class="hidden px-4 py-2 font-medium sm:table-cell">Last active</th>
						<th scope="col" class="hidden px-4 py-2 font-medium xl:table-cell">Created</th>
					</tr>
				</thead>
				<tbody>
					{#each page.items as org (org.id)}
						<tr class="border-b border-outline-subtle last:border-0 hover:bg-surface-container-low">
							<td class="px-4 py-2.5">
								<a href={`/infra/orgs/${org.id}`} class="block min-w-0 no-underline">
									<span class="flex flex-wrap items-center gap-2">
										<span class="font-medium text-on-surface">{org.name}</span>
										{#if org.deleted}<Badge size="sm" variant="error">Deleted</Badge>
										{:else if org.suspended}<Badge size="sm" variant="error">Suspended</Badge>{/if}
									</span>
									<span class="block truncate text-xs text-on-surface-subtle">/{org.slug}</span>
								</a>
							</td>
							<td class="hidden px-4 py-2.5 lg:table-cell">
								{#if org.owner}
									<a href={`/infra/users/${org.owner.id}`}>{org.owner.name}</a>
								{:else}
									<span class="text-on-surface-subtle">No owner</span>
								{/if}
							</td>
							<td class="px-4 py-2.5 text-right tabular-nums">
								{org.memberCount.toLocaleString()}
								{#if org.pendingInvitations > 0}
									<span class="block text-xs text-on-surface-subtle">{org.pendingInvitations} invited</span>
								{/if}
							</td>
							<td class="hidden px-4 py-2.5 text-right tabular-nums md:table-cell">{org.events30d.toLocaleString()}</td>
							<td class="hidden whitespace-nowrap px-4 py-2.5 text-on-surface-subtle sm:table-cell">{formatDaysAgo(org.lastActiveDay)}</td>
							<td class="hidden whitespace-nowrap px-4 py-2.5 text-on-surface-subtle xl:table-cell">{formatDate(org.createdAt)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
			<Pagination page={page.page} totalCount={page.totalCount} pageSize={page.pageSize} noun="organizations" href={pageHref} />
		</div>
	{/if}
</div>
