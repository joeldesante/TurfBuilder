<script lang="ts">
	import PageHeader from '$components/layout/page-header/PageHeader.svelte';
	import ArrowLeftIcon from 'phosphor-svelte/lib/ArrowLeft';

	interface Permission {
		id: string;
		key: string;
		label: string;
		group: string;
		description: string | null;
		value: boolean | null;
	}

	interface Props {
		userId: string;
		name: string;
		email: string;
		orgSlug: string;
		permissions: Permission[];
		onSetPermission: (permissionId: string, value: boolean | null) => Promise<void>;
	}

	const { userId, name, email, orgSlug, permissions, onSetPermission }: Props = $props();

	let saving = $state<string | null>(null);
	let error = $state<string | null>(null);

	const groups = $derived(
		permissions.reduce<Record<string, Permission[]>>((acc, p) => {
			(acc[p.group] ??= []).push(p);
			return acc;
		}, {})
	);

	async function handleChange(permId: string, value: boolean | null) {
		saving = permId;
		error = null;
		try {
			await onSetPermission(permId, value);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to save.';
		} finally {
			saving = null;
		}
	}

	function cycleValue(current: boolean | null): boolean | null {
		if (current === null) return true;
		if (current === true) return false;
		return null;
	}

	function stateLabel(value: boolean | null) {
		if (value === true) return 'Granted';
		if (value === false) return 'Denied';
		return 'Inherited';
	}

	function stateClass(value: boolean | null) {
		if (value === true) return 'bg-success text-on-success';
		if (value === false) return 'bg-error text-on-error';
		return 'bg-surface-container-high text-on-surface-subtle';
	}
</script>

<PageHeader title={name} subheading={email} />

<div class="p-6 max-w-2xl space-y-6">
	<a
		href="/o/{orgSlug}/s/members"
		class="inline-flex items-center gap-1.5 text-sm text-on-surface-subtle hover:text-on-surface transition-colors"
	>
		<ArrowLeftIcon size={14} />
		Back to Members
	</a>

	{#if error}
		<div class="rounded-lg border border-error bg-error/10 px-4 py-3 text-sm text-error">
			{error}
		</div>
	{/if}

	<div class="space-y-1 text-xs text-on-surface-subtle">
		<p>Click a permission badge to cycle: <strong>Inherited → Granted → Denied → Inherited</strong></p>
		<p>Inherited means the user's role determines access. Granted/Denied override the role.</p>
	</div>

	{#each Object.entries(groups) as [group, perms]}
		<div class="rounded-lg border border-outline overflow-hidden">
			<div class="px-4 py-2 bg-surface-container text-xs font-semibold text-on-surface-subtle uppercase tracking-wide">
				{group}
			</div>
			<div class="divide-y divide-outline">
				{#each perms as perm}
					<div class="flex items-center justify-between gap-4 px-4 py-3 bg-surface-container-low">
						<div class="space-y-0.5 min-w-0">
							<p class="text-sm font-medium text-on-surface">{perm.label}</p>
							{#if perm.description}
								<p class="text-xs text-on-surface-subtle">{perm.description}</p>
							{/if}
						</div>
						<button
							class="shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 {stateClass(perm.value)}"
							disabled={saving === perm.id}
							onclick={() => handleChange(perm.id, cycleValue(perm.value))}
						>
							{saving === perm.id ? '…' : stateLabel(perm.value)}
						</button>
					</div>
				{/each}
			</div>
		</div>
	{/each}
</div>
