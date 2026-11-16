<script lang="ts">
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import DataTable, {
		type DataTableColumn
	} from '$components/data-display/data-table/DataTable.svelte';
	import PlusIcon from 'phosphor-svelte/lib/Plus';
	import TrashIcon from 'phosphor-svelte/lib/Trash';
	import ShieldIcon from 'phosphor-svelte/lib/Shield';

	interface Role {
		id: string;
		name: string;
		/** No stored role has this yet; when set, the role shows as granting everything. */
		is_owner?: boolean;
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

	const columns: DataTableColumn<Role>[] = [
		{ id: 'name', header: 'Role', cell: nameCell },
		{
			id: 'permissions',
			header: 'Permissions',
			cell: permissionsCell,
			class: 'text-on-surface-subtle'
		},
		{ id: 'default', header: 'Default', cell: defaultCell, class: 'text-on-surface-subtle' },
		{ id: 'actions', header: 'Actions', srOnlyHeader: true, align: 'right', cell: actionsCell }
	];
</script>

{#snippet nameCell({ row: role }: { value: unknown; row: Role })}
	<a
		href={roleDetailHref(role.id)}
		class="font-medium text-on-surface hover:underline flex items-center gap-2"
	>
		{#if role.is_owner}
			<ShieldIcon class="size-4 text-primary" />
		{/if}
		{role.name}
	</a>
{/snippet}

{#snippet permissionsCell({ row: role }: { value: unknown; row: Role })}
	{#if role.is_owner}
		All permissions
	{:else}
		{role.permissions?.length ?? 0}
	{/if}
{/snippet}

{#snippet defaultCell({ row: role }: { value: unknown; row: Role })}
	{role.is_default ? 'Yes' : '—'}
{/snippet}

{#snippet actionsCell({ row: role }: { value: unknown; row: Role })}
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
{/snippet}

<PageHeader title="Roles" subheading="Manage roles and their permissions for this organization." />

<div class="p-6 space-y-6">
	<DataTable
		data={roles}
		{columns}
		getRowId={(role) => role.id}
		label="Roles"
		empty="No roles yet."
	/>
</div>
