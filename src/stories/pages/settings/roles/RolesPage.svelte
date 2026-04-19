<script lang="ts">
	import PageHeader from '$components/layout/page-header/PageHeader.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import PlusIcon from 'phosphor-svelte/lib/Plus';
	import TrashIcon from 'phosphor-svelte/lib/Trash';
	import ShieldIcon from 'phosphor-svelte/lib/Shield';

	interface Role {
		id: string;
		name: string;
		is_owner: boolean;
		is_default: boolean;
		permissions: string[] | null;
	}

	interface Props {
		roles: Role[];
		roleDetailHref: (id: string) => string;
		onCreate: (name: string) => Promise<void>;
		onDelete: (id: string) => Promise<void>;
	}

	const { roles, roleDetailHref, onCreate, onDelete }: Props = $props();

	let newRoleName = $state('');
	let creating = $state(false);
	let createError = $state<string | null>(null);
	let deletingId = $state<string | null>(null);

	async function handleCreate() {
		if (!newRoleName.trim()) return;
		creating = true;
		createError = null;
		try {
			await onCreate(newRoleName.trim());
			newRoleName = '';
		} catch (e) {
			createError = e instanceof Error ? e.message : 'Failed to create role.';
		} finally {
			creating = false;
		}
	}

	async function handleDelete(id: string) {
		deletingId = id;
		try {
			await onDelete(id);
		} finally {
			deletingId = null;
		}
	}
</script>

<PageHeader title="Roles" subheading="Manage roles and their permissions for this organization." />

<div class="p-6 space-y-6 max-w-3xl">
	<div class="rounded-lg border border-outline overflow-hidden">
		<table class="w-full text-sm">
			<thead class="bg-surface-container text-on-surface-subtle text-left">
				<tr>
					<th class="px-4 py-3 font-medium">Role</th>
					<th class="px-4 py-3 font-medium">Permissions</th>
					<th class="px-4 py-3 font-medium">Default</th>
					<th class="px-4 py-3"></th>
				</tr>
			</thead>
			<tbody class="divide-y divide-outline">
				{#each roles as role}
					<tr class="hover:bg-surface-container/50">
						<td class="px-4 py-3">
							<a
								href={roleDetailHref(role.id)}
								class="font-medium text-on-surface hover:underline flex items-center gap-2"
							>
								{#if role.is_owner}
									<ShieldIcon class="size-4 text-primary" />
								{/if}
								{role.name}
							</a>
						</td>
						<td class="px-4 py-3 text-on-surface-subtle">
							{#if role.is_owner}
								All permissions
							{:else}
								{role.permissions?.length ?? 0}
							{/if}
						</td>
						<td class="px-4 py-3 text-on-surface-subtle">
							{role.is_default ? 'Yes' : '—'}
						</td>
						<td class="px-4 py-3 text-right">
							{#if !role.is_owner && !role.is_default}
								<Button
									variant="ghost"
									size="sm"
									iconOnly
									aria-label="Delete role"
									loading={deletingId === role.id}
									onclick={() => handleDelete(role.id)}
								>
									<TrashIcon />
								</Button>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
