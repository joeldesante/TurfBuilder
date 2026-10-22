<script lang="ts" module>
	export type OrgTab = 'overview' | 'members' | 'invitations' | 'activity' | 'audit';

	export interface OwnerCandidate {
		memberId: string;
		name: string;
		email: string;
		memberRole: string;
	}

	/**
	 * What the page can ask the server to do. Each resolves when done and
	 * rejects with an Error whose message is safe to show.
	 */
	export interface OrgActions {
		suspend: (reason: string) => Promise<void>;
		unsuspend: () => Promise<void>;
		transferOwnership: (memberId: string) => Promise<void>;
		/** Members whose name or email contains the query, for choosing a new owner in an org of any size. */
		searchMembers: (query: string) => Promise<OwnerCandidate[]>;
		remove: (confirmSlug: string) => Promise<void>;
		restore: () => Promise<void>;
		removeMember: (memberId: string) => Promise<void>;
		cancelInvitation: (invitationId: string) => Promise<void>;
		revokeLink: (linkId: string) => Promise<void>;
	}
</script>

<script lang="ts">
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';
	import Tabs from '$components/layout/tabs/Tabs.svelte';
	import Badge from '$components/data-display/badge/Badge.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import DropdownMenu, { type DropdownMenuEntry } from '$components/actions/dropdown-menu/DropdownMenu.svelte';
	import ConfirmDialog from '$components/feedback/confirm-dialog/ConfirmDialog.svelte';
	import FormField from '$components/data-inputs/form-field/FormField.svelte';
	import TextInput from '$components/data-inputs/text-input/TextInput.svelte';
	import Textarea from '$components/data-inputs/textarea/Textarea.svelte';
	import Select from '$components/data-inputs/select/Select.svelte';
	import CopyButton from '$components/actions/copy-button/CopyButton.svelte';
	import Pagination from '$components/data-display/pagination/Pagination.svelte';
	import StatTile from '$components/data-display/stat-tile/StatTile.svelte';
	import LineChart from '$components/data-display/charts/LineChart/LineChart.svelte';
	import DonutChart from '$components/data-display/charts/DonutChart/DonutChart.svelte';
	import ActivityFeed from '$components/data-display/activity-feed/ActivityFeed.svelte';
	import AuditLogTable from '$components/data-display/audit-log-table/AuditLogTable.svelte';
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDown';
	import { formatDate, formatDateTime, formatDaysAgo } from '$lib/shared/utils/format-date';
	import type { Page } from '$lib/shared/utils/pagination';
	import type { TimeSeries } from '$lib/shared/types/charts';
	import type { OrgInvitation, OrgInviteLink, OrgMember, PlatformOrgDetail } from '$lib/shared/types/platform-organizations';
	import type { ActivityEntry } from '$lib/shared/types/activity';
	import type { AuditEntry } from '$lib/shared/types/audit';

	interface Props {
		org: PlatformOrgDetail;
		tab: OrgTab;
		/** The page of members; only loaded on the members tab. */
		members?: Page<OrgMember> | null;
		invitations?: { invitations: OrgInvitation[]; links: OrgInviteLink[] } | null;
		activity?: Page<ActivityEntry> | null;
		audit?: Page<AuditEntry> | null;
		/** Visits and active members over the last 90 days, for the overview chart. */
		activitySeries?: TimeSeries[];
		/** The viewing admin's infrastructure permissions. */
		permissions: string[];
		actions: OrgActions;
	}

	let {
		org,
		tab,
		members = null,
		invitations = null,
		activity = null,
		audit = null,
		activitySeries = [],
		permissions,
		actions
	}: Props = $props();

	const canManage = $derived(permissions.includes('orgs.manage'));

	const tabs = $derived([
		{ id: 'overview', label: 'Overview', href: '?tab=overview' },
		{ id: 'members', label: 'Members', href: '?tab=members', count: org.counts.members },
		{ id: 'invitations', label: 'Invitations', href: '?tab=invitations', count: org.pendingInvitations || undefined },
		{ id: 'activity', label: 'Activity', href: '?tab=activity' },
		{ id: 'audit', label: 'Audit', href: '?tab=audit' }
	]);

	type DialogId = 'suspend' | 'unsuspend' | 'transfer' | 'delete' | 'restore' | 'remove-member' | null;
	let dialog = $state<DialogId>(null);
	let busy = $state(false);
	let dialogError = $state<string | null>(null);

	let suspendReason = $state('');
	let deleteConfirm = $state('');
	let newOwnerId = $state('');
	let memberToRemove = $state<OrgMember | null>(null);

	// The new owner is found by search, so any member of an org of any size can be chosen.
	let ownerQuery = $state('');
	let ownerResults = $state<OwnerCandidate[] | null>(null);
	let searchingOwners = $state(false);
	const ownerCandidates = $derived((ownerResults ?? []).filter((m) => !m.memberRole.includes('owner')));

	async function searchOwners() {
		if (!ownerQuery.trim()) return;
		searchingOwners = true;
		dialogError = null;
		newOwnerId = '';
		try {
			ownerResults = await actions.searchMembers(ownerQuery.trim());
		} catch (e) {
			dialogError = e instanceof Error ? e.message : 'The search did not work. Try again.';
		} finally {
			searchingOwners = false;
		}
	}

	function open(id: Exclude<DialogId, null>) {
		dialogError = null;
		if (id === 'suspend') suspendReason = '';
		if (id === 'delete') deleteConfirm = '';
		if (id === 'transfer') {
			newOwnerId = '';
			ownerQuery = '';
			ownerResults = null;
		}
		dialog = id;
	}

	function close() {
		if (!busy) dialog = null;
	}

	async function run(action: () => Promise<void>) {
		busy = true;
		dialogError = null;
		try {
			await action();
			dialog = null;
		} catch (e) {
			dialogError = e instanceof Error ? e.message : 'That did not work. Try again.';
		} finally {
			busy = false;
		}
	}

	let rowBusy = $state<string | null>(null);
	let rowError = $state<string | null>(null);

	async function rowAction(id: string, action: () => Promise<void>) {
		rowBusy = id;
		rowError = null;
		try {
			await action();
		} catch (e) {
			rowError = e instanceof Error ? e.message : 'That did not work. Try again.';
		} finally {
			rowBusy = null;
		}
	}

	const menu = $derived<DropdownMenuEntry[]>(
		(<(DropdownMenuEntry | null)[]>[
			canManage && !org.deleted && !org.suspended ? { label: 'Suspend', variant: 'destructive' as const, onclick: () => open('suspend') } : null,
			canManage && org.suspended && !org.deleted ? { label: 'Lift suspension', onclick: () => open('unsuspend') } : null,
			canManage && !org.deleted ? { label: 'Transfer ownership', onclick: () => open('transfer') } : null,
			canManage && org.deleted ? { label: 'Restore', onclick: () => open('restore') } : null,
			canManage && !org.deleted ? { separator: true as const } : null,
			canManage && !org.deleted ? { label: 'Delete organization', variant: 'destructive' as const, onclick: () => open('delete') } : null
		]).filter((entry): entry is DropdownMenuEntry => entry !== null)
	);

	const pageHref = (target: number) => `?tab=${tab}&page=${target}`;

	const memberActivity = $derived([
		{ key: 'active', label: 'Active in the last 30 days', value: org.memberActivity.active },
		{ key: 'dormant', label: 'Not active lately', value: org.memberActivity.dormant },
		{ key: 'never', label: 'Never active', value: org.memberActivity.never }
	]);
</script>

<PageHeader title={org.name} breadcrumbs={[{ label: 'Organizations', href: '/infra/orgs' }, { label: org.name }]}>
	{#snippet actions()}
		{#if menu.length > 0}
			<DropdownMenu items={menu} align="end">
				{#snippet trigger(props)}
					<Button {...props} variant="outline">Actions <CaretDownIcon /></Button>
				{/snippet}
			</DropdownMenu>
		{/if}
	{/snippet}
</PageHeader>

<div class="space-y-6">
	<section class="flex flex-wrap items-center gap-x-4 gap-y-2" aria-label="Summary">
		<p class="text-on-surface-subtle">/{org.slug}</p>
		<CopyButton value={org.id} aria-label="Copy organization ID" />
		<div class="flex flex-wrap gap-1">
			{#if org.deleted}<Badge size="sm" variant="error">Deleted</Badge>{/if}
			{#if org.suspended}<Badge size="sm" variant="error">Suspended</Badge>{/if}
		</div>
	</section>

	{#if org.suspended}
		<div class="rounded-lg border border-error bg-error-container px-4 py-3 text-sm text-on-error-container" role="status">
			<p class="font-medium">Suspended {org.suspendedAt ? formatDate(org.suspendedAt) : ''}. Members cannot open it.</p>
			{#if org.suspendedReason}<p class="mt-1">{org.suspendedReason}</p>{/if}
		</div>
	{/if}
	{#if org.deleted}
		<div class="rounded-lg border border-error bg-error-container px-4 py-3 text-sm text-on-error-container" role="status">
			<p class="font-medium">Deleted {org.deletedAt ? formatDate(org.deletedAt) : ''}. Its data is kept and can be restored.</p>
		</div>
	{/if}

	<Tabs {tabs} active={tab} label="Organization sections" />

	{#if tab === 'overview'}
		<section aria-label="Who runs it">
			<h2 class="text-sm font-medium text-on-surface">Who runs it</h2>
			<ul class="mt-2 divide-y divide-outline-subtle rounded-xl border border-outline-subtle">
				{#each org.leaders as leader (leader.userId)}
					<li class="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5 text-sm">
						<a href={`/infra/users/${leader.userId}`} class="font-medium">{leader.name}</a>
						<span class="text-on-surface-subtle">{leader.email}</span>
						<span class="text-on-surface-subtle">{leader.owner ? 'Owner' : (leader.roleName ?? 'Administrator')}</span>
					</li>
				{:else}
					<li class="px-4 py-6 text-center text-sm text-on-surface-subtle">Nobody holds an owner or administrator role.</li>
				{/each}
			</ul>
			<p class="mt-2 text-sm text-on-surface-subtle">
				Created {formatDate(org.createdAt)}{#if org.createdBy}
					by <a href={`/infra/users/${org.createdBy.id}`}>{org.createdBy.name}</a>{/if}. Last active {formatDaysAgo(org.lastActiveDay)}.
			</p>
		</section>

		<section aria-label="Figures" class="grid grid-cols-2 gap-3 lg:grid-cols-4">
			<StatTile label="Members" value={org.counts.members} format="compact" hint={`${org.counts.activeMembers30d.toLocaleString()} active in 30 days`} />
			<StatTile label="Visits" value={org.counts.visits} format="compact" hint={`${org.counts.visits30d.toLocaleString()} in 30 days`} />
			<StatTile label="Conversations" value={org.counts.conversations} format="compact" />
			<StatTile label="Locations" value={org.counts.records} format="compact" />
			<StatTile label="Lists" value={org.counts.lists} format="compact" />
			<StatTile label="Turfs" value={org.counts.turfs} format="compact" />
			<StatTile label="Surveys" value={org.counts.surveys} format="compact" />
			<StatTile label="PDF documents" value={org.counts.documents} format="compact" />
		</section>

		<section class="grid gap-4 lg:grid-cols-3" aria-label="Activity">
			<LineChart
				class="lg:col-span-2"
				title="Activity"
				subtitle="Last 90 days, by week"
				series={activitySeries}
				granularity="week"
				csvFilename={`${org.slug}-activity`}
			/>
			<DonutChart title="Member activity" data={memberActivity} centerLabel="Members" csvFilename={`${org.slug}-member-activity`} />
		</section>

		<section aria-label="Plugins">
			<h2 class="text-sm font-medium text-on-surface">Plugins</h2>
			{#if org.plugins.length === 0}
				<p class="mt-1 text-sm text-on-surface-subtle">None installed.</p>
			{:else}
				<ul class="mt-2 flex flex-wrap gap-2">
					{#each org.plugins as plugin (plugin.slug)}
						<li><Badge size="sm" variant={plugin.enabled ? 'success' : 'default'}>{plugin.slug}{plugin.enabled ? '' : ' (off)'}</Badge></li>
					{/each}
				</ul>
			{/if}
		</section>
	{:else if tab === 'members'}
		{#if rowError}
			<p class="rounded-lg bg-error-container px-4 py-2 text-sm text-on-error-container" role="alert">{rowError}</p>
		{/if}
		<div class="rounded-xl border border-outline-subtle">
			{#if !members || members.items.length === 0}
				<p class="px-4 py-8 text-center text-sm text-on-surface-subtle">No members.</p>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead class="text-left text-on-surface-subtle">
							<tr class="border-b border-outline-subtle">
								<th scope="col" class="px-4 py-2 font-medium">Member</th>
								<th scope="col" class="px-4 py-2 font-medium">Role</th>
								<th scope="col" class="hidden px-4 py-2 font-medium sm:table-cell">Joined</th>
								<th scope="col" class="px-4 py-2 font-medium">Last active</th>
								{#if canManage}<th scope="col" class="px-4 py-2"><span class="sr-only">Actions</span></th>{/if}
							</tr>
						</thead>
						<tbody>
							{#each members.items as m (m.memberId)}
								<tr class="border-b border-outline-subtle last:border-0">
									<td class="px-4 py-2.5">
										<a href={`/infra/users/${m.userId}`} class="font-medium">{m.name}</a>
										<span class="block text-xs text-on-surface-subtle">{m.email}</span>
									</td>
									<td class="px-4 py-2.5">{m.roleName ?? 'Member'}{m.memberRole.includes('owner') ? ', owner' : ''}</td>
									<td class="hidden whitespace-nowrap px-4 py-2.5 text-on-surface-subtle sm:table-cell">{formatDate(m.joinedAt)}</td>
									<td class="whitespace-nowrap px-4 py-2.5 text-on-surface-subtle">{formatDaysAgo(m.lastActiveDay)}</td>
									{#if canManage}
										<td class="px-4 py-2.5 text-right">
											{#if !m.memberRole.includes('owner')}
												<Button
													size="sm"
													variant="outline"
													aria-label={`Remove ${m.name}`}
													loading={rowBusy === m.memberId}
													onclick={() => {
														memberToRemove = m;
														open('remove-member');
													}}
												>
													Remove
												</Button>
											{/if}
										</td>
									{/if}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<Pagination page={members.page} totalCount={members.totalCount} pageSize={members.pageSize} noun="members" href={pageHref} />
			{/if}
		</div>
	{:else if tab === 'invitations'}
		{#if rowError}
			<p class="rounded-lg bg-error-container px-4 py-2 text-sm text-on-error-container" role="alert">{rowError}</p>
		{/if}
		<section aria-label="Email invitations">
			<h2 class="text-sm font-medium text-on-surface">Email invitations</h2>
			<ul class="mt-2 divide-y divide-outline-subtle rounded-xl border border-outline-subtle">
				{#each invitations?.invitations ?? [] as inv (inv.id)}
					<li class="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
						<div class="min-w-0">
							<p class="font-medium text-on-surface">{inv.email}</p>
							<p class="text-xs text-on-surface-subtle">
								Invited {formatDate(inv.createdAt)}{inv.inviterName ? ` by ${inv.inviterName}` : ''}
							</p>
						</div>
						{#if canManage}
							<Button size="sm" variant="outline" aria-label={`Cancel invitation for ${inv.email}`} loading={rowBusy === inv.id} onclick={() => rowAction(inv.id, () => actions.cancelInvitation(inv.id))}>
								Cancel
							</Button>
						{/if}
					</li>
				{:else}
					<li class="px-4 py-6 text-center text-sm text-on-surface-subtle">No pending invitations.</li>
				{/each}
			</ul>
		</section>
		<section aria-label="Invite links" class="mt-6">
			<h2 class="text-sm font-medium text-on-surface">Invite links</h2>
			<ul class="mt-2 divide-y divide-outline-subtle rounded-xl border border-outline-subtle">
				{#each invitations?.links ?? [] as link (link.id)}
					<li class="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
						<div class="min-w-0">
							<p class="font-medium text-on-surface">Link made {formatDate(link.createdAt)}{link.createdBy ? ` by ${link.createdBy}` : ''}</p>
							<p class="text-xs text-on-surface-subtle">
								{link.expiresAt ? `Expires ${formatDateTime(link.expiresAt)}` : 'Does not expire'}
							</p>
						</div>
						{#if canManage}
							<Button size="sm" variant="outline" aria-label={`Turn off link made ${formatDate(link.createdAt)}`} loading={rowBusy === link.id} onclick={() => rowAction(link.id, () => actions.revokeLink(link.id))}>
								Turn off
							</Button>
						{/if}
					</li>
				{:else}
					<li class="px-4 py-6 text-center text-sm text-on-surface-subtle">No open invite links.</li>
				{/each}
			</ul>
		</section>
	{:else if tab === 'activity'}
		<div class="rounded-xl border border-outline-subtle">
			<ActivityFeed items={activity?.items ?? []} showOrg={false} userHref={(id) => `/infra/users/${id}`} />
			{#if activity}
				<Pagination page={activity.page} totalCount={activity.totalCount} pageSize={activity.pageSize} noun="events" href={pageHref} />
			{/if}
		</div>
	{:else if tab === 'audit'}
		<div class="rounded-xl border border-outline-subtle">
			<AuditLogTable items={audit?.items ?? []} showTarget={false} emptyText="No admin has changed this organization." />
			{#if audit}
				<Pagination page={audit.page} totalCount={audit.totalCount} pageSize={audit.pageSize} noun="changes" href={pageHref} />
			{/if}
		</div>
	{/if}
</div>

<ConfirmDialog
	open={dialog === 'suspend'}
	title={`Suspend ${org.name}?`}
	description="Members cannot open the organization until it is lifted. Nothing is deleted."
	confirmLabel="Suspend"
	destructive
	loading={busy}
	error={dialogError}
	onCancel={close}
	onConfirm={() => {
		if (!suspendReason.trim()) {
			dialogError = 'Give a reason; members see it.';
			return;
		}
		run(() => actions.suspend(suspendReason.trim()));
	}}
>
	<FormField label="Reason" helperText="Shown to members who try to open it.">
		<Textarea bind:value={suspendReason} rows={3} />
	</FormField>
</ConfirmDialog>

<ConfirmDialog
	open={dialog === 'unsuspend'}
	title="Lift the suspension?"
	description={`Members can open ${org.name} again right away.`}
	confirmLabel="Lift suspension"
	loading={busy}
	error={dialogError}
	onCancel={close}
	onConfirm={() => run(actions.unsuspend)}
/>

<ConfirmDialog
	open={dialog === 'transfer'}
	title="Transfer ownership"
	description="The new owner gets the owner role. Current owners become administrators."
	confirmLabel="Transfer"
	loading={busy}
	error={dialogError}
	onCancel={close}
	onConfirm={() => {
		if (!newOwnerId) {
			dialogError = 'Choose the new owner.';
			return;
		}
		run(() => actions.transferOwnership(newOwnerId));
	}}
>
	<div class="space-y-3">
		<form
			class="flex gap-2"
			onsubmit={(event) => {
				event.preventDefault();
				searchOwners();
			}}
		>
			<TextInput type="search" bind:value={ownerQuery} placeholder="Name or email" aria-label="Find a member" class="min-w-0 flex-1" />
			<Button type="submit" variant="outline" loading={searchingOwners}>Search</Button>
		</form>
		{#if ownerResults !== null}
			{#if ownerCandidates.length === 0}
				<p class="text-sm text-on-surface-subtle">No member who is not already an owner matches.</p>
			{:else}
				<FormField label="New owner">
					<Select
						bind:value={newOwnerId}
						placeholder="Choose a member"
						items={ownerCandidates.map((m) => ({ value: m.memberId, label: `${m.name} (${m.email})` }))}
					/>
				</FormField>
			{/if}
		{/if}
	</div>
</ConfirmDialog>

<ConfirmDialog
	open={dialog === 'delete'}
	title={`Delete ${org.name}?`}
	description="Members lose access and the organization disappears from their lists. Its data is kept, and you can restore it later."
	confirmLabel="Delete organization"
	destructive
	loading={busy}
	error={dialogError}
	onCancel={close}
	onConfirm={() => {
		if (deleteConfirm.trim() !== org.slug) {
			dialogError = 'Type the slug exactly to confirm.';
			return;
		}
		run(() => actions.remove(deleteConfirm.trim()));
	}}
>
	<FormField label={`Type ${org.slug} to confirm`}>
		<TextInput bind:value={deleteConfirm} autocomplete="off" />
	</FormField>
</ConfirmDialog>

<ConfirmDialog
	open={dialog === 'restore'}
	title={`Restore ${org.name}?`}
	description="Members can open it again."
	confirmLabel="Restore"
	loading={busy}
	error={dialogError}
	onCancel={close}
	onConfirm={() => run(actions.restore)}
/>

<ConfirmDialog
	open={dialog === 'remove-member'}
	title={`Remove ${memberToRemove?.name ?? 'this member'}?`}
	description="They lose access to the organization. Their past visits stay with it."
	confirmLabel="Remove"
	destructive
	loading={busy}
	error={dialogError}
	onCancel={close}
	onConfirm={() => {
		const target = memberToRemove;
		if (target) run(() => actions.removeMember(target.memberId));
	}}
/>
