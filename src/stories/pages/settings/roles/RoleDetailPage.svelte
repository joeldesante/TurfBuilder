<script lang="ts">
	import PageHeader from '$components/layout/page-header/PageHeader.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import Switch from '$components/data-inputs/switch/Switch.svelte';
	import { PERMISSION_GROUPS } from '$lib/permissions-config';

	interface Role {
		id: string;
		name: string;
		is_owner: boolean;
		is_default: boolean;
		permissions: string[] | null;
	}

	interface Member {
		id: string;
		name: string;
		email: string;
		role_id: string | null;
		role_name: string | null;
	}

	interface Props {
		role: Role;
		members: Member[];
		rolesHref: string;
		onSavePermissions: (permissions: string[]) => Promise<void>;
		onSaveName: (name: string) => Promise<void>;
		onAssignRole: (userId: string, roleId: string | null) => Promise<void>;
	}

	const { role, members, rolesHref, onSavePermissions, onSaveName, onAssignRole }: Props =
		$props();

	let roleName = $state(role.name);
	let savingName = $state(false);
	let nameError = $state<string | null>(null);

	// Build a Set of currently granted permissions.
	let granted = $state(new Set<string>(role.permissions ?? []));
	let savingPerms = $state(false);

	function toggle(key: string) {
		const next = new Set(granted);
		if (next.has(key)) {
			next.delete(key);
		} else {
			next.add(key);
		}
		granted = next;
		savePermissions();
	}

	async function savePermissions() {
		savingPerms = true;
		try {
			await onSavePermissions([...granted]);
		} finally {
			savingPerms = false;
		}
	}

	async function handleSaveName() {
		savingName = true;
		nameError = null;
		try {
			await onSaveName(roleName);
		} catch (e) {
			nameError = e instanceof Error ? e.message : 'Failed to save.';
		} finally {
			savingName = false;
		}
	}

	let assigningUserId = $state<string | null>(null);

	async function handleAssign(userId: string, roleId: string | null) {
		assigningUserId = userId;
		try {
			await onAssignRole(userId, roleId);
		} finally {
			assigningUserId = null;
		}
	}
</script>

<PageHeader
	title={role.name}
	subheading={role.is_owner ? 'Owner role — has all permissions by default.' : undefined}
	breadcrumbs={[{ label: 'Roles', href: rolesHref }]}
/>

<div class="p-6 space-y-8 max-w-3xl">
	{#if !role.is_owner}
		<!-- Role name + default flag -->
		<section class="space-y-3">
			<h2 class="text-sm font-semibold text-on-surface">Role Settings</h2>
			<div class="flex gap-3 items-end">
				<div class="flex-1 space-y-1">
					<label for="role-name" class="text-sm text-on-surface-subtle">Name</label>
					<input
						id="role-name"
						type="text"
						bind:value={roleName}
						class="w-full h-10 px-3 rounded-lg border border-outline bg-surface text-sm text-on-surface focus:outline-2 focus:outline-offset-2 focus:outline-primary"
					/>
				</div>
				<Button onclick={handleSaveName} loading={savingName} disabled={!roleName.trim()}>
					Save
				</Button>
			</div>
{#if nameError}
				<p class="text-error text-sm">{nameError}</p>
			{/if}
		</section>

		<!-- Permissions -->
		<section class="space-y-6">
			<div class="flex items-center justify-between">
				<h2 class="text-sm font-semibold text-on-surface">Permissions</h2>
				{#if savingPerms}
					<span class="text-xs text-on-surface-subtle">Saving…</span>
				{/if}
			</div>

			{#each PERMISSION_GROUPS as group}
				<div class="space-y-1">
					<h3 class="text-xs font-semibold uppercase tracking-wider text-on-surface-subtle px-1">
						{group.name}
					</h3>
					<div class="rounded-lg border border-outline divide-y divide-outline">
						{#each group.permissions as perm}
							<div class="flex items-start justify-between gap-6 px-4 py-3">
								<div class="flex-1 space-y-0.5 min-w-0">
									<p class="text-sm font-medium text-on-surface">
										<span class="text-primary">{role.name}</span> can {perm.verbPhrase}
									</p>
									<p class="text-xs text-on-surface-subtle">{perm.description}</p>
								</div>
								<Switch
									checked={granted.has(perm.key)}
									onCheckedChange={() => toggle(perm.key)}
								/>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</section>
	{/if}

	<!-- Member assignment -->
	<section class="space-y-3">
		<h2 class="text-sm font-semibold text-on-surface">Members</h2>
		<div class="rounded-lg border border-outline overflow-hidden">
			<table class="w-full text-sm">
				<thead class="bg-surface-container text-on-surface-subtle text-left">
					<tr>
						<th class="px-4 py-3 font-medium">Name</th>
						<th class="px-4 py-3 font-medium">Email</th>
						<th class="px-4 py-3 font-medium">Current Role</th>
						<th class="px-4 py-3"></th>
					</tr>
				</thead>
				<tbody class="divide-y divide-outline">
					{#each members as member}
						<tr class="hover:bg-surface-container/50">
							<td class="px-4 py-3 font-medium text-on-surface">{member.name}</td>
							<td class="px-4 py-3 text-on-surface-subtle">{member.email}</td>
							<td class="px-4 py-3 text-on-surface-subtle">{member.role_name ?? '—'}</td>
							<td class="px-4 py-3 text-right">
								{#if member.role_id === role.id}
									<Button
										variant="outline"
										size="sm"
										loading={assigningUserId === member.id}
										onclick={() => handleAssign(member.id, null)}
									>
										Remove
									</Button>
								{:else}
									<Button
										size="sm"
										loading={assigningUserId === member.id}
										onclick={() => handleAssign(member.id, role.id)}
									>
										Assign
									</Button>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
</div>
