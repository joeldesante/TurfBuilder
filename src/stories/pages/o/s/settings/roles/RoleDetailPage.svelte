<script lang="ts">
	import { untrack } from 'svelte';
	import FormField from '$components/data-inputs/form-field/FormField.svelte';
	import TextInput from '$components/data-inputs/text-input/TextInput.svelte';
	import { Form } from '$lib/client/formstorm/form.svelte';
	import { createNamedResourceSchema } from '$lib/shared/schemas/named-resource';
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import Switch from '$components/data-inputs/switch/Switch.svelte';
	import { PERMISSION_GROUPS } from '$lib/permissions-config';

	interface Role {
		id: string;
		name: string;
		is_default: boolean;
		is_admin: boolean;
		permissions: string[] | null;
	}

	interface Props {
		role: Role;
		rolesHref: string;
		onSavePermissions: (permissions: string[]) => Promise<void>;
		onSaveName: (name: string) => Promise<void>;
	}

	const { role, rolesHref, onSavePermissions, onSaveName }: Props = $props();

	const nameForm = new Form(
		createNamedResourceSchema,
		async (values) => {
			await onSaveName(values.name);
		},
		{ name: untrack(() => role.name) }
	);

	let grantedKeys = $state<string[]>([]);
	// Initializes and re-syncs with server state after invalidation (e.g. after name save).
	$effect(() => { grantedKeys = role.permissions ?? []; });
	let granted = $derived(new Set(grantedKeys));
	let savingPerms = $state(false);

	function isLocked(key: string) {
		return role.is_admin && key === 'system.access';
	}

	function toggle(key: string) {
		if (isLocked(key)) return;
		if (grantedKeys.includes(key)) {
			grantedKeys = grantedKeys.filter(k => k !== key);
		} else {
			grantedKeys = [...grantedKeys, key];
		}
		savePermissions();
	}

	async function savePermissions() {
		savingPerms = true;
		try {
			await onSavePermissions(grantedKeys);
		} finally {
			savingPerms = false;
		}
	}
</script>

<PageHeader
	title={role.name}
	subheading={role.is_default ? 'Default role — automatically assigned to all new members.' : undefined}
	breadcrumbs={[{ label: 'Roles', href: rolesHref }]}
/>

<div class="p-6 space-y-8 max-w-3xl">
	<!-- Role name + default flag -->
	<section class="space-y-3">
			<h2 class="text-sm font-semibold text-on-surface">Role Settings</h2>
			<form
				class="flex gap-3 items-start"
				novalidate
				onsubmit={(e) => {
					e.preventDefault();
					nameForm.submit();
				}}
			>
				<FormField
					label="Name"
					id="role-name"
					class="flex-1"
					errors={nameForm.errors.name ?? []}
					dirty={!!nameForm.touched.name}
				>
					<TextInput bind:value={nameForm.values.name} onfocusout={() => nameForm.touch('name')} />
				</FormField>
				<Button type="submit" loading={nameForm.submitting} class="mt-6">Save</Button>
			</form>
			{#if nameForm.errorMessage}
				<p class="text-error text-sm" role="alert">{nameForm.errorMessage}</p>
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
									disabled={isLocked(perm.key)}
								/>
							</div>
						{/each}
					</div>
				</div>
			{/each}
	</section>
</div>
