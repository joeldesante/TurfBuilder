<script lang="ts">
	import PageHeader from '$components/layout/page-header/PageHeader.svelte';
	import Button from '$components/actions/button/Button.svelte';
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
		members: Member[];
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

	async function handleAssignRole(userId: string, roleId: string) {
		assigningId = userId;
		try {
			await onAssignRole(userId, roleId === '' ? null : roleId);
		} finally {
			assigningId = null;
		}
	}
</script>

<PageHeader title="Members" subheading="Manage who has access to this organization." />

<div class="p-6 space-y-6 max-w-3xl">
	<div class="rounded-lg border border-outline overflow-hidden">
		<table class="w-full text-sm">
			<thead class="bg-surface-container text-on-surface-subtle text-left">
				<tr>
					<th class="px-4 py-3 font-medium">Name</th>
					<th class="px-4 py-3 font-medium">Email</th>
					<th class="px-4 py-3 font-medium">Role</th>
					{#if canRemoveMembers}
						<th class="px-4 py-3"></th>
					{/if}
				</tr>
			</thead>
			<tbody class="divide-y divide-outline">
				{#each members as member}
					<tr class="hover:bg-surface-container/50">
						<td class="px-4 py-3 font-medium text-on-surface">
							<a href="/o/{orgSlug}/s/members/{member.id}" class="hover:underline">{member.name}</a>
						</td>
						<td class="px-4 py-3 text-on-surface-subtle">{member.email}</td>
						<td class="px-4 py-3">
						{#if canManageRoles}
							<select
								class="text-sm bg-transparent border border-outline rounded px-2 py-1 text-on-surface disabled:opacity-50"
								value={member.role_id ?? ''}
								disabled={assigningId === member.id}
								onchange={(e) => handleAssignRole(member.id, e.currentTarget.value)}
							>
								<option value="">— No role —</option>
								{#each roles as role}
									<option value={role.id}>{role.name}</option>
								{/each}
							</select>
						{:else}
							<span class="text-on-surface-subtle">{member.role_name ?? '—'}</span>
						{/if}
					</td>
						{#if canRemoveMembers}
							<td class="px-4 py-3 text-right">
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
							</td>
						{/if}
					</tr>
				{:else}
					<tr>
						<td
							colspan={canRemoveMembers ? 4 : 3}
							class="px-4 py-8 text-center text-on-surface-subtle"
						>
							No members yet.
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
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
