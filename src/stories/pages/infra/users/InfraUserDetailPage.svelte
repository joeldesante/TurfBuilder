<script lang="ts" module>
	import type { UpdateUserInput, SuspendUserInput } from '$lib/shared/schemas/platform-users';

	export type UserTab = 'overview' | 'organizations' | 'sessions' | 'activity' | 'emails' | 'audit';

	/**
	 * What the page can ask the server to do. Each resolves when done and
	 * rejects with an Error whose message is safe to show.
	 */
	export interface UserActions {
		update: (input: UpdateUserInput) => Promise<void>;
		sendPasswordReset: () => Promise<void>;
		sendVerification: () => Promise<void>;
		resetTwoFactor: () => Promise<void>;
		suspend: (input: SuspendUserInput) => Promise<void>;
		unsuspend: () => Promise<void>;
		revokeSessions: () => Promise<void>;
		revokeSession: (sessionId: string) => Promise<void>;
		impersonate: () => Promise<void>;
		remove: (confirmEmail: string) => Promise<void>;
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';
	import Tabs from '$components/layout/tabs/Tabs.svelte';
	import Badge from '$components/data-display/badge/Badge.svelte';
	import Avatar from '$components/data-display/avatar/Avatar.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import DropdownMenu, { type DropdownMenuEntry } from '$components/actions/dropdown-menu/DropdownMenu.svelte';
	import ConfirmDialog from '$components/feedback/confirm-dialog/ConfirmDialog.svelte';
	import FormField from '$components/data-inputs/form-field/FormField.svelte';
	import TextInput from '$components/data-inputs/text-input/TextInput.svelte';
	import Textarea from '$components/data-inputs/textarea/Textarea.svelte';
	import Select from '$components/data-inputs/select/Select.svelte';
	import Switch from '$components/data-inputs/switch/Switch.svelte';
	import Pagination from '$components/data-display/pagination/Pagination.svelte';
	import ActivityFeed from '$components/data-display/activity-feed/ActivityFeed.svelte';
	import AuditLogTable from '$components/data-display/audit-log-table/AuditLogTable.svelte';
	import EmailLogTable from '$components/data-display/email-log-table/EmailLogTable.svelte';
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDown';
	import { formatDate, formatDateTime, formatDaysAgo } from '$lib/shared/utils/format-date';
	import { describeUserAgent } from '$lib/shared/utils/user-agent';
	import type { Page } from '$lib/shared/utils/pagination';
	import type { PlatformUserDetail, UserMembership, UserSession } from '$lib/shared/types/platform-users';
	import type { ActivityEntry, EmailLogEntry } from '$lib/shared/types/activity';
	import type { AuditEntry } from '$lib/shared/types/audit';

	interface Props {
		user: PlatformUserDetail;
		tab: UserTab;
		memberships: UserMembership[];
		sessions: UserSession[];
		/** The page of the active tab's feed; only that tab's is loaded. */
		activity?: Page<ActivityEntry> | null;
		emails?: Page<EmailLogEntry> | null;
		audit?: Page<AuditEntry> | null;
		/** The viewing admin's infrastructure permissions. */
		permissions: string[];
		/** The viewing admin, so they are not offered actions on themselves. */
		currentUserId: string;
		actions: UserActions;
		/** The activity chart, drawn by the route so this page stays free of chart data loading. */
		activityChart?: Snippet;
	}

	let {
		user,
		tab,
		memberships,
		sessions,
		activity = null,
		emails = null,
		audit = null,
		permissions,
		currentUserId,
		actions,
		activityChart
	}: Props = $props();

	const canManage = $derived(permissions.includes('users.manage') && !user.deleted);
	const canImpersonate = $derived(
		permissions.includes('users.impersonate') && !user.deleted && !user.isInfraAdmin && user.id !== currentUserId
	);
	const isSelf = $derived(user.id === currentUserId);

	const tabs = $derived([
		{ id: 'overview', label: 'Overview', href: '?tab=overview' },
		{ id: 'organizations', label: 'Organizations', href: '?tab=organizations', count: memberships.length },
		{ id: 'sessions', label: 'Sessions', href: '?tab=sessions', count: sessions.length },
		{ id: 'activity', label: 'Activity', href: '?tab=activity' },
		{ id: 'emails', label: 'Emails', href: '?tab=emails' },
		{ id: 'audit', label: 'Audit', href: '?tab=audit' }
	]);

	// One dialog at a time; each knows how to run its action.
	type DialogId =
		| 'edit'
		| 'reset'
		| 'verification'
		| 'two-factor'
		| 'suspend'
		| 'unsuspend'
		| 'revoke'
		| 'impersonate'
		| 'delete'
		| null;
	let dialog = $state<DialogId>(null);
	let busy = $state(false);
	let dialogError = $state<string | null>(null);

	let editName = $state('');
	let editEmail = $state('');
	let editUsername = $state('');
	let editVerified = $state(false);
	let suspendReason = $state('');
	let suspendFor = $state('indefinite');
	let deleteConfirm = $state('');

	function open(id: Exclude<DialogId, null>) {
		dialogError = null;
		if (id === 'edit') {
			editName = user.name;
			editEmail = user.email;
			editUsername = user.displayUsername || user.username;
			editVerified = user.emailVerified;
		}
		if (id === 'suspend') {
			suspendReason = '';
			suspendFor = 'indefinite';
		}
		if (id === 'delete') deleteConfirm = '';
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

	let endingSession = $state<string | null>(null);
	let sessionError = $state<string | null>(null);

	async function endSession(sessionId: string) {
		endingSession = sessionId;
		sessionError = null;
		try {
			await actions.revokeSession(sessionId);
		} catch (e) {
			sessionError = e instanceof Error ? e.message : 'The session could not be ended.';
		} finally {
			endingSession = null;
		}
	}

	function editChanges(): UpdateUserInput {
		const changes: UpdateUserInput = {};
		if (editName.trim() !== user.name) changes.name = editName.trim();
		if (editEmail.trim().toLowerCase() !== user.email) changes.email = editEmail.trim();
		if (editUsername.trim().toLowerCase() !== user.username) changes.username = editUsername.trim();
		if (editVerified !== user.emailVerified) changes.emailVerified = editVerified;
		return changes;
	}

	const SUSPEND_DAYS: Record<string, number | null> = { '1': 1, '7': 7, '30': 30, indefinite: null };

	function suspendInput(): SuspendUserInput {
		const days = SUSPEND_DAYS[suspendFor];
		return {
			reason: suspendReason.trim(),
			expiresAt: days ? new Date(Date.now() + days * 86_400_000).toISOString() : null
		};
	}

	const menu = $derived<DropdownMenuEntry[]>(
		(<(DropdownMenuEntry | null)[]>[
			canManage ? { label: 'Edit details', onclick: () => open('edit') } : null,
			canManage ? { label: 'Send password reset', onclick: () => open('reset') } : null,
			canManage && !user.emailVerified ? { label: 'Resend verification email', onclick: () => open('verification') } : null,
			canManage && user.twoFactorEnabled ? { label: 'Turn off two-factor sign-in', onclick: () => open('two-factor') } : null,
			canManage && sessions.length > 0 ? { label: 'Sign out everywhere', onclick: () => open('revoke') } : null,
			canImpersonate ? { label: 'Impersonate', onclick: () => open('impersonate') } : null,
			canManage && !isSelf ? { separator: true as const } : null,
			canManage && !isSelf && !user.suspended && !user.isInfraAdmin
				? { label: 'Suspend', variant: 'destructive' as const, onclick: () => open('suspend') }
				: null,
			canManage && user.suspended ? { label: 'Lift suspension', onclick: () => open('unsuspend') } : null,
			canManage && !isSelf ? { label: 'Delete account', variant: 'destructive' as const, onclick: () => open('delete') } : null
		]).filter((entry): entry is DropdownMenuEntry => entry !== null)
	);

	function pageHref(target: number) {
		return `?tab=${tab}&page=${target}`;
	}

	const signInLabel: Record<string, string> = { credential: 'Email and password' };
</script>

<PageHeader
	title={user.name}
	breadcrumbs={[{ label: 'Users', href: '/infra/users' }, { label: user.name }]}
>
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
	<section class="flex flex-col gap-4 sm:flex-row sm:items-center" aria-label="Summary">
		<Avatar username={user.name} size="lg" />
		<div class="min-w-0 flex-1">
			<p class="break-all text-on-surface">{user.email}</p>
			<p class="text-sm text-on-surface-subtle">@{user.displayUsername || user.username}</p>
			<div class="mt-2 flex flex-wrap gap-1">
				{#if user.deleted}<Badge size="sm" variant="error">Deleted</Badge>{/if}
				{#if user.suspended}<Badge size="sm" variant="error">Suspended</Badge>{/if}
				{#if user.emailVerified}
					<Badge size="sm" variant="success">Email verified</Badge>
				{:else}
					<Badge size="sm" variant="warning">Email not verified</Badge>
				{/if}
				{#if user.twoFactorEnabled}<Badge size="sm">Two-factor on</Badge>{/if}
				{#each user.infraRoles as role (role.id)}<Badge size="sm" variant="info">{role.name}</Badge>{/each}
			</div>
		</div>
	</section>

	{#if user.suspended}
		<div class="rounded-lg border border-error bg-error-container px-4 py-3 text-sm text-on-error-container" role="status">
			<p class="font-medium">
				Suspended {user.suspendedUntil ? `until ${formatDateTime(user.suspendedUntil)}` : 'until lifted'}.
			</p>
			{#if user.suspendedReason}<p class="mt-1">{user.suspendedReason}</p>{/if}
		</div>
	{/if}

	<Tabs {tabs} active={tab} label="User sections" />

	{#if tab === 'overview'}
		<dl class="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
			<div>
				<dt class="text-sm text-on-surface-subtle">Joined</dt>
				<dd class="text-on-surface">{formatDate(user.createdAt)}</dd>
			</div>
			<div>
				<dt class="text-sm text-on-surface-subtle">Last active</dt>
				<dd class="text-on-surface">{formatDaysAgo(user.lastActiveDay)}</dd>
			</div>
			<div>
				<dt class="text-sm text-on-surface-subtle">Organizations</dt>
				<dd class="text-on-surface tabular-nums">{user.orgCount}</dd>
			</div>
			<div>
				<dt class="text-sm text-on-surface-subtle">Signed in on</dt>
				<dd class="text-on-surface tabular-nums">
					{user.activeSessionCount}
					{user.activeSessionCount === 1 ? 'device' : 'devices'}
				</dd>
			</div>
			<div class="sm:col-span-2">
				<dt class="text-sm text-on-surface-subtle">Signs in with</dt>
				<dd class="text-on-surface">
					{user.signInMethods.length
						? user.signInMethods.map((m) => signInLabel[m.providerId] ?? m.providerId).join(', ')
						: 'No sign-in method'}
				</dd>
			</div>
			<div class="sm:col-span-2">
				<dt class="text-sm text-on-surface-subtle">Infrastructure roles</dt>
				<dd class="text-on-surface">{user.infraRoles.length ? user.infraRoles.map((r) => r.name).join(', ') : 'None'}</dd>
			</div>
		</dl>
		{@render activityChart?.()}
	{:else if tab === 'organizations'}
		{#if memberships.length === 0}
			<p class="py-8 text-center text-sm text-on-surface-subtle">Not a member of any organization.</p>
		{:else}
			<div class="overflow-x-auto rounded-xl border border-outline-subtle">
				<table class="w-full text-sm">
					<thead class="text-left text-on-surface-subtle">
						<tr class="border-b border-outline-subtle">
							<th scope="col" class="px-4 py-2 font-medium">Organization</th>
							<th scope="col" class="px-4 py-2 font-medium">Role</th>
							<th scope="col" class="hidden px-4 py-2 font-medium sm:table-cell">Joined</th>
							<th scope="col" class="px-4 py-2 font-medium">Last active there</th>
						</tr>
					</thead>
					<tbody>
						{#each memberships as m (m.memberId)}
							<tr class="border-b border-outline-subtle last:border-0">
								<td class="px-4 py-2.5">
									<a href={`/infra/orgs/${m.organizationId}`} class="font-medium">{m.name}</a>
									{#if m.suspended}<Badge size="sm" variant="error">Suspended</Badge>{/if}
									{#if m.deleted}<Badge size="sm" variant="error">Deleted</Badge>{/if}
								</td>
								<td class="px-4 py-2.5">
									{m.roleName ?? 'Member'}{m.memberRole.includes('owner') ? ', owner' : ''}
								</td>
								<td class="hidden whitespace-nowrap px-4 py-2.5 text-on-surface-subtle sm:table-cell">{formatDate(m.joinedAt)}</td>
								<td class="whitespace-nowrap px-4 py-2.5 text-on-surface-subtle">{formatDaysAgo(m.lastActiveDay)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{:else if tab === 'sessions'}
		{#if sessionError}
			<p class="rounded-lg bg-error-container px-4 py-2 text-sm text-on-error-container" role="alert">{sessionError}</p>
		{/if}
		{#if sessions.length === 0}
			<p class="py-8 text-center text-sm text-on-surface-subtle">Not signed in anywhere.</p>
		{:else}
			<ul class="divide-y divide-outline-subtle rounded-xl border border-outline-subtle">
				{#each sessions as s (s.id)}
					<li class="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
						<div class="min-w-0">
							<p class="font-medium text-on-surface">
								{describeUserAgent(s.userAgent)}
								{#if s.impersonatedBy}<Badge size="sm" variant="warning">Impersonated by {s.impersonatedBy.name}</Badge>{/if}
							</p>
							<p class="text-xs text-on-surface-subtle">
								{s.ipAddress ?? 'Unknown address'}. Last used {formatDateTime(s.updatedAt)}. Ends {formatDate(s.expiresAt)}.
							</p>
						</div>
						{#if canManage}
							<Button size="sm" variant="outline" loading={endingSession === s.id} onclick={() => endSession(s.id)}>
								End session
							</Button>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	{:else if tab === 'activity'}
		<div class="rounded-xl border border-outline-subtle">
			<ActivityFeed items={activity?.items ?? []} showUser={false} orgHref={(id) => `/infra/orgs/${id}`} />
			{#if activity}
				<Pagination page={activity.page} totalCount={activity.totalCount} pageSize={activity.pageSize} noun="events" href={pageHref} />
			{/if}
		</div>
	{:else if tab === 'emails'}
		<div class="rounded-xl border border-outline-subtle">
			<EmailLogTable items={emails?.items ?? []} showRecipient={false} emptyText="No emails sent to this address." />
			{#if emails}
				<Pagination page={emails.page} totalCount={emails.totalCount} pageSize={emails.pageSize} noun="emails" href={pageHref} />
			{/if}
		</div>
	{:else if tab === 'audit'}
		<div class="rounded-xl border border-outline-subtle">
			<AuditLogTable items={audit?.items ?? []} showTarget={false} emptyText="No admin has changed this account." />
			{#if audit}
				<Pagination page={audit.page} totalCount={audit.totalCount} pageSize={audit.pageSize} noun="changes" href={pageHref} />
			{/if}
		</div>
	{/if}
</div>

<ConfirmDialog
	open={dialog === 'edit'}
	title="Edit details"
	confirmLabel="Save"
	loading={busy}
	error={dialogError}
	onCancel={close}
	onConfirm={() => {
		const changes = editChanges();
		if (Object.keys(changes).length === 0) {
			dialog = null;
			return;
		}
		run(() => actions.update(changes));
	}}
>
	<div class="space-y-3">
		<FormField label="Name"><TextInput bind:value={editName} /></FormField>
		<FormField label="Email" helperText="A new address is unverified unless you mark it verified below.">
			<TextInput bind:value={editEmail} type="email" />
		</FormField>
		<FormField label="Username"><TextInput bind:value={editUsername} /></FormField>
		<Switch id="edit-email-verified" checked={editVerified} onCheckedChange={(next) => (editVerified = next)}>Email verified</Switch>
	</div>
</ConfirmDialog>

<ConfirmDialog
	open={dialog === 'reset'}
	title="Send a password reset?"
	description={`${user.email} gets a link to choose a new password. Their current password keeps working until they do.`}
	confirmLabel="Send"
	loading={busy}
	error={dialogError}
	onCancel={close}
	onConfirm={() => run(actions.sendPasswordReset)}
/>

<ConfirmDialog
	open={dialog === 'verification'}
	title="Resend the verification email?"
	description={`${user.email} gets a new link to verify their address.`}
	confirmLabel="Send"
	loading={busy}
	error={dialogError}
	onCancel={close}
	onConfirm={() => run(actions.sendVerification)}
/>

<ConfirmDialog
	open={dialog === 'two-factor'}
	title="Turn off two-factor sign-in?"
	description="They can sign in with their password alone until they set it up again. Only do this once you are sure who is asking."
	confirmLabel="Turn off"
	destructive
	loading={busy}
	error={dialogError}
	onCancel={close}
	onConfirm={() => run(actions.resetTwoFactor)}
/>

<ConfirmDialog
	open={dialog === 'revoke'}
	title="Sign out everywhere?"
	description={isSelf
		? 'Every other device you are signed in on is signed out. This one stays signed in.'
		: `${user.name} is signed out on every device and has to sign in again.`}
	confirmLabel="Sign out"
	loading={busy}
	error={dialogError}
	onCancel={close}
	onConfirm={() => run(actions.revokeSessions)}
/>

<ConfirmDialog
	open={dialog === 'impersonate'}
	title={`Sign in as ${user.name}?`}
	description="You see the app as they do for up to an hour, and anything you change is changed for them and recorded in the audit log. A banner lets you stop at any time."
	confirmLabel="Impersonate"
	loading={busy}
	error={dialogError}
	onCancel={close}
	onConfirm={() => run(actions.impersonate)}
/>

<ConfirmDialog
	open={dialog === 'suspend'}
	title={`Suspend ${user.name}?`}
	description="They are signed out now and cannot sign in until the suspension ends. Their organizations and records are not changed."
	confirmLabel="Suspend"
	destructive
	loading={busy}
	error={dialogError}
	onCancel={close}
	onConfirm={() => {
		if (!suspendReason.trim()) {
			dialogError = 'Give a reason; the user sees it when they try to sign in.';
			return;
		}
		run(() => actions.suspend(suspendInput()));
	}}
>
	<div class="space-y-3">
		<FormField label="Reason" helperText="Shown to them when they try to sign in.">
			<Textarea bind:value={suspendReason} rows={3} />
		</FormField>
		<FormField label="For">
			<Select
				bind:value={suspendFor}
				items={[
					{ value: '1', label: '1 day' },
					{ value: '7', label: '7 days' },
					{ value: '30', label: '30 days' },
					{ value: 'indefinite', label: 'Until lifted' }
				]}
			/>
		</FormField>
	</div>
</ConfirmDialog>

<ConfirmDialog
	open={dialog === 'unsuspend'}
	title="Lift the suspension?"
	description={`${user.name} can sign in again right away.`}
	confirmLabel="Lift suspension"
	loading={busy}
	error={dialogError}
	onCancel={close}
	onConfirm={() => run(actions.unsuspend)}
/>

<ConfirmDialog
	open={dialog === 'delete'}
	title={`Delete ${user.name}?`}
	description="Their name, email, and ways to sign in are removed and they leave every organization. Visits and other records they made stay with their organizations, credited to a deleted user. This cannot be undone."
	confirmLabel="Delete account"
	destructive
	loading={busy}
	error={dialogError}
	onCancel={close}
	onConfirm={() => {
		if (deleteConfirm.trim().toLowerCase() !== user.email.toLowerCase()) {
			dialogError = 'Type the email exactly to confirm.';
			return;
		}
		run(() => actions.remove(deleteConfirm.trim()));
	}}
>
	<FormField label={`Type ${user.email} to confirm`}>
		<TextInput bind:value={deleteConfirm} autocomplete="off" />
	</FormField>
</ConfirmDialog>
