<script lang="ts">
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import Dropdown from '$components/data-inputs/dropdown/Dropdown.svelte';
	import DataTable, {
		type DataTableColumn
	} from '$components/data-display/data-table/DataTable.svelte';
	import Pagination from '$components/data-display/pagination/Pagination.svelte';
	import InviteLinksSection from './InviteLinksSection.svelte';
	import TrashIcon from 'phosphor-svelte/lib/Trash';

	interface Member {
		id: string;
		name: string;
		email: string;
		role_id: string | null;
		role_name: string | null;
	}

	interface InviteLink {
		id: string;
		created_at: string;
		expires_at: string | null;
	}

	interface Role {
		id: string;
		name: string;
	}

	interface Props {
		/** One page of members, already ordered and sliced by the server. */
		members: Member[];
		/** Every member across all pages. Defaults to the rows given. */
		totalCount?: number;
		/** 1-based index of the page in `members`. */
		page?: number;
		pageSize?: number;
		roles: Role[];
		canRemoveMembers: boolean;
		canManageRoles: boolean;
		canInvite: boolean;
		inviteLinks: InviteLink[];
		slugInviteEnabled: boolean;
		orgSlug: string;
		onRemove: (userId: string) => Promise<void>;
		onAssignRole: (userId: string, roleId: string | null) => Promise<void>;
		onCreateLink: (expiresAt: string | null) => Promise<void>;
		onRevokeLink: (id: string) => Promise<void>;
		onToggleSlugInvite: (enabled: boolean) => Promise<void>;
	}

	const {
		members,
		totalCount: totalCountProp,
		page = 1,
		pageSize = 100,
		roles,
		canRemoveMembers,
		canManageRoles,
		canInvite,
		inviteLinks,
		slugInviteEnabled,
		orgSlug,
		onRemove,
		onAssignRole,
		onCreateLink,
		onRevokeLink,
		onToggleSlugInvite
	}: Props = $props();

	const totalCount = $derived(totalCountProp ?? members.length);

	let removingId = $state<string | null>(null);
	let assigningId = $state<string | null>(null);

	async function handleRemove(userId: string) {
		removingId = userId;
		try {
			await onRemove(userId);
		} finally {
			removingId = null;
		}
	}

	/** Stands for "no role" in the dropdown, which cannot hold an empty value. */
	const NO_ROLE = '__none__';

	/** The role a member was just given, until the change is saved or refused. */
	let pendingRole = $state<Record<string, string>>({});

	const roleItems = $derived([
		{ value: NO_ROLE, label: '— No role —' },
		...roles.map((role) => ({ value: role.id, label: role.name }))
	]);

	async function handleAssignRole(userId: string, roleId: string) {
		assigningId = userId;
		pendingRole = { ...pendingRole, [userId]: roleId };
		try {
			await onAssignRole(userId, roleId === NO_ROLE ? null : roleId);
		} finally {
			assigningId = null;
			// Back to the role the member really has: after a refused change the
			// props are unchanged, so the dropdown would keep showing the pick.
			const { [userId]: _done, ...rest } = pendingRole;
			pendingRole = rest;
		}
	}

	const columns = $derived<DataTableColumn<Member>[]>([
		{ id: 'name', header: 'Name', cell: nameCell, class: 'font-medium' },
		{ id: 'email', header: 'Email', accessorKey: 'email', class: 'text-on-surface-subtle' },
		{ id: 'role', header: 'Role', cell: roleCell },
		...(canRemoveMembers
			? [
					{
						id: 'actions',
						header: 'Actions',
						srOnlyHeader: true,
						align: 'right' as const,
						cell: actionsCell
					}
				]
			: [])
	]);
</script>

{#snippet nameCell({ row: member }: { value: unknown; row: Member })}
	<a href="/o/{orgSlug}/s/members/{member.id}" class="hover:underline">{member.name}</a>
{/snippet}

{#snippet roleCell({ row: member }: { value: unknown; row: Member })}
	{#if canManageRoles}
		<Dropdown
			class="w-48 !h-9 !text-sm"
			aria-label="Role for {member.name}"
			items={roleItems}
			value={pendingRole[member.id] ?? member.role_id ?? NO_ROLE}
			disabled={assigningId === member.id}
			onValueChange={(next) => handleAssignRole(member.id, next)}
		/>
	{:else}
		<span class="text-on-surface-subtle">{member.role_name ?? '—'}</span>
	{/if}
{/snippet}

{#snippet actionsCell({ row: member }: { value: unknown; row: Member })}
	<Button
		variant="ghost"
		size="sm"
		iconOnly
		aria-label="Remove member"
		loading={removingId === member.id}
		onclick={() => handleRemove(member.id)}
	>
		<TrashIcon />
	</Button>
{/snippet}

<PageHeader title="Members" subheading="Manage who has access to this organization." />

<div class="p-6 space-y-6">
	<div class="rounded-lg border border-outline overflow-hidden">
		<Pagination {page} {totalCount} {pageSize} noun="members" />
		<DataTable
			data={members}
			{columns}
			getRowId={(member) => member.id}
			label="Members"
			empty="No members yet."
			bordered={false}
		/>
		<Pagination {page} {totalCount} {pageSize} noun="members" />
	</div>

	{#if canInvite}
		<InviteLinksSection
			{inviteLinks}
			{slugInviteEnabled}
			{orgSlug}
			onCreate={onCreateLink}
			onRevoke={onRevokeLink}
			onToggleSlug={onToggleSlugInvite}
		/>
	{/if}
</div>
