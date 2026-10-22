<script lang="ts">
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';
	import Badge from '$components/data-display/badge/Badge.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import ConfirmDialog from '$components/feedback/confirm-dialog/ConfirmDialog.svelte';
	import TextInput from '$components/data-inputs/text-input/TextInput.svelte';
	import Select from '$components/data-inputs/select/Select.svelte';
	import { infraPermissionLabel } from '$lib/shared/registries/infra-permissions';
	import { formatDate } from '$lib/shared/utils/format-date';
	import type { InfraAdmin, InfraRole } from '$lib/shared/types/infra-admins';

	interface Candidate {
		id: string;
		name: string;
		email: string;
	}

	interface Props {
		admins: InfraAdmin[];
		roles: InfraRole[];
		currentUserId: string;
		/** Finds users to make admins. */
		onsearch: (query: string) => Promise<Candidate[]>;
		/** Each resolves when done and rejects with an Error whose message is safe to show. */
		ongrant: (userId: string, roleId: string) => Promise<void>;
		onrevoke: (userId: string, roleId: string) => Promise<void>;
	}

	let { admins, roles, currentUserId, onsearch, ongrant, onrevoke }: Props = $props();

	// Adding an admin: search, pick one person, pick a role.
	let query = $state('');
	let results = $state<Candidate[] | null>(null);
	let searching = $state(false);
	let searchError = $state<string | null>(null);
	let chosen = $state<Candidate | null>(null);
	let roleId = $state('');
	let granting = $state(false);
	let grantError = $state<string | null>(null);

	async function search() {
		if (!query.trim()) return;
		searching = true;
		searchError = null;
		try {
			results = await onsearch(query.trim());
		} catch (e) {
			searchError = e instanceof Error ? e.message : 'The search did not work. Try again.';
		} finally {
			searching = false;
		}
	}

	async function grant() {
		if (!chosen || !roleId) {
			grantError = !chosen ? 'Choose a person.' : 'Choose a role.';
			return;
		}
		granting = true;
		grantError = null;
		try {
			await ongrant(chosen.id, roleId);
			chosen = null;
			results = null;
			query = '';
			roleId = '';
		} catch (e) {
			grantError = e instanceof Error ? e.message : 'That did not work. Try again.';
		} finally {
			granting = false;
		}
	}

	// Removing a role.
	let removal = $state<{ admin: InfraAdmin; role: InfraAdmin['roles'][number] } | null>(null);
	let removing = $state(false);
	let removeError = $state<string | null>(null);

	async function confirmRemoval() {
		if (!removal) return;
		removing = true;
		removeError = null;
		try {
			await onrevoke(removal.admin.id, removal.role.id);
			removal = null;
		} catch (e) {
			removeError = e instanceof Error ? e.message : 'That did not work. Try again.';
		} finally {
			removing = false;
		}
	}
</script>

<PageHeader title="Admins" subheading="Who can use this panel, and what each role allows." />

<div class="space-y-8">
	<section aria-labelledby="roles-heading">
		<h2 id="roles-heading" class="text-lg font-medium text-on-surface">Roles</h2>
		<ul class="mt-3 grid gap-3 lg:grid-cols-2">
			{#each roles as role (role.id)}
				<li class="rounded-xl border border-outline-subtle p-4">
					<p class="font-medium text-on-surface">
						{role.name}
						<span class="font-normal text-on-surface-subtle">held by {role.holderCount}</span>
					</p>
					<ul class="mt-2 list-disc space-y-0.5 pl-5 text-sm text-on-surface-subtle">
						{#each role.permissions as permission (permission)}
							<li>{infraPermissionLabel(permission)}</li>
						{:else}
							<li class="list-none">Allows nothing yet.</li>
						{/each}
					</ul>
				</li>
			{/each}
		</ul>
	</section>

	<section aria-labelledby="admins-heading">
		<h2 id="admins-heading" class="text-lg font-medium text-on-surface">Admins</h2>
		<ul class="mt-3 divide-y divide-outline-subtle rounded-xl border border-outline-subtle">
			{#each admins as admin (admin.id)}
				<li class="space-y-2 px-4 py-3">
					<div class="flex flex-wrap items-baseline justify-between gap-2">
						<p class="min-w-0">
							<a href={`/infra/users/${admin.id}`} class="font-medium">{admin.name}</a>
							{#if admin.id === currentUserId}<span class="text-sm text-on-surface-subtle">(you)</span>{/if}
							<span class="block text-sm text-on-surface-subtle">{admin.email}</span>
						</p>
						{#if admin.canManageAdmins}<Badge size="sm" variant="info">Can manage admins</Badge>{/if}
					</div>
					<ul class="flex flex-wrap gap-2">
						{#each admin.roles as role (role.id)}
							<li class="flex items-center gap-1 rounded-md bg-surface-container-high py-0.5 pl-2 pr-1 text-sm text-on-surface">
								<span>{role.name}</span>
								<span class="text-xs text-on-surface-subtle">since {formatDate(role.grantedAt)}</span>
								<Button
									size="sm"
									variant="ghost"
									aria-label={`Remove ${role.name} from ${admin.name}`}
									onclick={() => {
										removeError = null;
										removal = { admin, role };
									}}
								>
									Remove
								</Button>
							</li>
						{:else}
							<li class="text-sm text-on-surface-subtle">Has permissions granted directly, with no role.</li>
						{/each}
					</ul>
				</li>
			{:else}
				<li class="px-4 py-6 text-center text-sm text-on-surface-subtle">No admins.</li>
			{/each}
		</ul>
	</section>

	<section aria-labelledby="add-heading" class="max-w-xl space-y-3">
		<h2 id="add-heading" class="text-lg font-medium text-on-surface">Add an admin</h2>
		<form
			class="flex gap-2"
			onsubmit={(event) => {
				event.preventDefault();
				search();
			}}
		>
			<TextInput type="search" bind:value={query} placeholder="Name or email" aria-label="Find a user" class="min-w-0 flex-1" />
			<Button type="submit" variant="outline" loading={searching}>Search</Button>
		</form>
		{#if searchError}<p role="alert" class="text-sm text-error">{searchError}</p>{/if}

		{#if results}
			{#if results.length === 0}
				<p class="text-sm text-on-surface-subtle">No one matches.</p>
			{:else}
				<ul class="divide-y divide-outline-subtle rounded-xl border border-outline-subtle" aria-label="Search results">
					{#each results as candidate (candidate.id)}
						<li class="flex items-center justify-between gap-2 px-4 py-2 text-sm">
							<span class="min-w-0 truncate">{candidate.name} <span class="text-on-surface-subtle">{candidate.email}</span></span>
							<Button
								size="sm"
								variant={chosen?.id === candidate.id ? 'primary' : 'outline'}
								aria-pressed={chosen?.id === candidate.id}
								aria-label={`Choose ${candidate.name}`}
								onclick={() => (chosen = candidate)}
							>
								{chosen?.id === candidate.id ? 'Chosen' : 'Choose'}
							</Button>
						</li>
					{/each}
				</ul>
			{/if}
		{/if}

		{#if chosen}
			<div class="flex flex-wrap items-end gap-2">
				<label class="flex flex-col gap-1 text-sm text-on-surface">
					Role for {chosen.name}
					<Select bind:value={roleId} placeholder="Choose a role" items={roles.map((r) => ({ value: r.id, label: r.name }))} />
				</label>
				<Button onclick={grant} loading={granting}>Give role</Button>
			</div>
			{#if grantError}<p role="alert" class="text-sm text-error">{grantError}</p>{/if}
		{/if}
	</section>
</div>

<ConfirmDialog
	open={removal !== null}
	title={removal ? `Remove ${removal.role.name} from ${removal.admin.name}?` : ''}
	description="They lose whatever permissions only this role gave them, right away. The panel will not let you remove the last admin who can manage users."
	confirmLabel="Remove role"
	destructive
	loading={removing}
	error={removeError}
	onCancel={() => !removing && (removal = null)}
	onConfirm={confirmRemoval}
/>
