<script lang="ts">
	import PageHeader from '$components/layout/page-header/PageHeader.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import InviteLinksSection from './InviteLinksSection.svelte';
	import PlusIcon from 'phosphor-svelte/lib/Plus';
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
		canAddMembers: boolean;
		canRemoveMembers: boolean;
		isOwner: boolean;
		inviteLinks: InviteLink[];
		slugInviteEnabled: boolean;
		orgSlug: string;
		onAdd: (email: string) => Promise<void>;
		onRemove: (userId: string) => Promise<void>;
		onCreateLink: (expiresAt: string | null) => Promise<void>;
		onRevokeLink: (id: string) => Promise<void>;
		onToggleSlugInvite: (enabled: boolean) => Promise<void>;
	}

	const {
		members,
		canAddMembers,
		canRemoveMembers,
		isOwner,
		inviteLinks,
		slugInviteEnabled,
		orgSlug,
		onAdd,
		onRemove,
		onCreateLink,
		onRevokeLink,
		onToggleSlugInvite
	}: Props = $props();

	let email = $state('');
	let adding = $state(false);
	let addError = $state<string | null>(null);
	let removingId = $state<string | null>(null);

	async function handleAdd() {
		if (!email.trim()) return;
		adding = true;
		addError = null;
		try {
			await onAdd(email.trim());
			email = '';
		} catch (e) {
			addError = e instanceof Error ? e.message : 'Failed to add member.';
		} finally {
			adding = false;
		}
	}

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

	{#if canAddMembers}
		<div class="space-y-2">
			<h2 class="text-sm font-medium text-on-surface">Add Member</h2>
			<div class="flex gap-2">
				<input
					type="email"
					bind:value={email}
					placeholder="user@example.com"
					class="flex-1 h-10 px-3 rounded-lg border border-outline bg-surface text-sm text-on-surface focus:outline-2 focus:outline-offset-2 focus:outline-primary"
					onkeydown={(e) => e.key === 'Enter' && handleAdd()}
				/>
				<Button onclick={handleAdd} loading={adding} disabled={!email.trim()}>
					<PlusIcon />
					Add
				</Button>
			</div>
			{#if addError}
				<p class="text-error text-sm">{addError}</p>
			{/if}
		</div>
	{/if}

	{#if isOwner}
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
