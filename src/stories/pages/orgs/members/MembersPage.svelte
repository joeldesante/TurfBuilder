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

	interface Props {
		members: Member[];
		canRemoveMembers: boolean;
		canInvite: boolean;
		inviteLinks: InviteLink[];
		slugInviteEnabled: boolean;
		orgSlug: string;
		onRemove: (userId: string) => Promise<void>;
		onCreateLink: (expiresAt: string | null) => Promise<void>;
		onRevokeLink: (id: string) => Promise<void>;
		onToggleSlugInvite: (enabled: boolean) => Promise<void>;
	}

	const {
		members,
		canRemoveMembers,
		canInvite,
		inviteLinks,
		slugInviteEnabled,
		orgSlug,
		onRemove,
		onCreateLink,
		onRevokeLink,
		onToggleSlugInvite
	}: Props = $props();

	let removingId = $state<string | null>(null);

	async function handleRemove(userId: string) {
		removingId = userId;
		try {
			await onRemove(userId);
		} finally {
			removingId = null;
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
						<td class="px-4 py-3 font-medium text-on-surface">{member.name}</td>
						<td class="px-4 py-3 text-on-surface-subtle">{member.email}</td>
						<td class="px-4 py-3 text-on-surface-subtle">{member.role_name ?? '—'}</td>
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
