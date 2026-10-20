<script lang="ts">
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';
	import Pagination from '$components/data-display/pagination/Pagination.svelte';
	import Badge from '$components/data-display/badge/Badge.svelte';
	import Avatar from '$components/data-display/avatar/Avatar.svelte';
	import TextInput from '$components/data-inputs/text-input/TextInput.svelte';
	import Select from '$components/data-inputs/select/Select.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlass';
	import { formatDate, formatDaysAgo } from '$lib/shared/utils/format-date';
	import type { Page } from '$lib/shared/utils/pagination';
	import type { PlatformUserRow, UserFilters, UserSort, UserStatusFilter } from '$lib/shared/types/platform-users';

	interface Props {
		page: Page<PlatformUserRow>;
		filters: UserFilters;
		/** Applies new filters, usually by navigating to a URL with them. */
		onfilter: (filters: UserFilters) => void;
	}

	let { page, filters, onfilter }: Props = $props();

	// Local copies of the filters; applied on submit or when a select changes.
	let q = $state('');
	let status = $state<UserStatusFilter>('all');
	let sort = $state<UserSort>('newest');
	$effect.pre(() => {
		q = filters.q ?? '';
		status = filters.status ?? 'all';
		sort = filters.sort ?? 'newest';
	});

	const statusItems: { value: UserStatusFilter; label: string }[] = [
		{ value: 'all', label: 'Everyone' },
		{ value: 'unverified', label: 'Email not verified' },
		{ value: 'suspended', label: 'Suspended' },
		{ value: 'two_factor', label: 'Two-factor on' },
		{ value: 'infra_admin', label: 'Infrastructure admins' },
		{ value: 'no_orgs', label: 'In no organization' },
		{ value: 'never_active', label: 'Never active' }
	];

	const sortItems: { value: UserSort; label: string }[] = [
		{ value: 'newest', label: 'Newest first' },
		{ value: 'oldest', label: 'Oldest first' },
		{ value: 'recently_active', label: 'Recently active' },
		{ value: 'name', label: 'Name' }
	];

	function apply(overrides: Partial<UserFilters> = {}) {
		onfilter({
			q: q.trim() || undefined,
			status: status === 'all' ? undefined : status,
			sort: sort === 'newest' ? undefined : sort,
			...overrides
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
	title="Users"
	subheading="Every account on this instance. Open one to see its organizations and sessions, or to act on it."
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
			<span class="sr-only">Search users</span>
			<MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-subtle" />
			<TextInput bind:value={q} type="search" placeholder="Name, email, or username" class="pl-9" />
		</label>
		<div class="grid grid-cols-2 gap-2 sm:flex">
			<Select
				bind:value={status}
				items={statusItems}
				aria-label="Show"
				onchange={() => apply()}
				class="sm:w-52"
			/>
			<Select bind:value={sort} items={sortItems} aria-label="Sort" onchange={() => apply()} class="sm:w-44" />
		</div>
		<Button type="submit" variant="outline">Search</Button>
	</form>

	{#if page.items.length === 0}
		<div class="rounded-xl border border-outline-subtle px-6 py-12 text-center">
			<p class="font-medium text-on-surface">{filtered ? 'No users match.' : 'No users yet.'}</p>
			{#if filtered}
				<p class="mt-1 text-sm text-on-surface-subtle">Try a shorter search, or show everyone.</p>
				<Button class="mt-4" variant="outline" onclick={() => onfilter({})}>Clear filters</Button>
			{/if}
		</div>
	{:else}
		<div class="overflow-x-auto rounded-xl border border-outline-subtle">
			<table class="w-full text-sm">
				<thead class="text-left text-on-surface-subtle">
					<tr class="border-b border-outline-subtle">
						<th scope="col" class="px-4 py-2 font-medium">User</th>
						<th scope="col" class="hidden px-4 py-2 font-medium md:table-cell">Joined</th>
						<th scope="col" class="hidden px-4 py-2 font-medium sm:table-cell">Last active</th>
						<th scope="col" class="hidden px-4 py-2 text-right font-medium lg:table-cell">Organizations</th>
						<th scope="col" class="px-4 py-2 font-medium"><span class="sr-only">Status</span></th>
					</tr>
				</thead>
				<tbody>
					{#each page.items as user (user.id)}
						<tr class="border-b border-outline-subtle last:border-0 hover:bg-surface-container-low">
							<td class="px-4 py-2.5">
								<a href={`/infra/users/${user.id}`} class="flex min-w-0 items-center gap-3 no-underline">
									<Avatar username={user.name} size="sm" />
									<span class="min-w-0">
										<span class="block truncate font-medium text-on-surface">{user.name}</span>
										<span class="block truncate text-xs text-on-surface-subtle">{user.email}</span>
									</span>
								</a>
							</td>
							<td class="hidden whitespace-nowrap px-4 py-2.5 text-on-surface-subtle md:table-cell">
								{formatDate(user.createdAt)}
							</td>
							<td class="hidden whitespace-nowrap px-4 py-2.5 text-on-surface-subtle sm:table-cell">
								{formatDaysAgo(user.lastActiveDay)}
							</td>
							<td class="hidden px-4 py-2.5 text-right tabular-nums lg:table-cell">{user.orgCount}</td>
							<td class="px-4 py-2.5">
								<div class="flex flex-wrap justify-end gap-1">
									{#if user.suspended}<Badge size="sm" variant="error">Suspended</Badge>{/if}
									{#if !user.emailVerified}<Badge size="sm" variant="warning">Unverified</Badge>{/if}
									{#if user.isInfraAdmin}<Badge size="sm" variant="info">Admin</Badge>{/if}
									{#if user.twoFactorEnabled}<Badge size="sm">2FA</Badge>{/if}
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
			<Pagination page={page.page} totalCount={page.totalCount} pageSize={page.pageSize} noun="users" href={pageHref} />
		</div>
	{/if}
</div>
