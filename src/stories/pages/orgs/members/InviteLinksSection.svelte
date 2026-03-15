<script lang="ts">
	import type { DateValue } from '@internationalized/date';
	import Time from 'svelte-time/Time.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import Switch from '$components/data-inputs/switch/Switch.svelte';
	import CopyButton from '$components/actions/copy-button/CopyButton.svelte';
	import DatePicker from '$components/data-inputs/date-picker/DatePicker.svelte';
	import PlusIcon from 'phosphor-svelte/lib/Plus';
	import TrashIcon from 'phosphor-svelte/lib/Trash';

	interface InviteLink {
		id: string;
		created_at: string;
		expires_at: string | null;
	}

	interface Props {
		inviteLinks: InviteLink[];
		slugInviteEnabled: boolean;
		orgSlug: string;
		onCreate: (expiresAt: string | null) => Promise<void>;
		onRevoke: (id: string) => Promise<void>;
		onToggleSlug: (enabled: boolean) => Promise<void>;
	}

	const { inviteLinks, slugInviteEnabled, orgSlug, onCreate, onRevoke, onToggleSlug }: Props =
		$props();

	const baseUrl = $derived(
		typeof window !== 'undefined' ? `${window.location.origin}/invite/` : '/invite/'
	);

	let expiryDate = $state<DateValue | undefined>(undefined);
	let creating = $state(false);
	let createError = $state<string | null>(null);
	let revokingId = $state<string | null>(null);
	let toggling = $state(false);
	let toggleError = $state<string | null>(null);

	async function handleCreate() {
		creating = true;
		createError = null;
		try {
			await onCreate(expiryDate?.toString() ?? null);
			expiryDate = undefined;
		} catch (e) {
			createError = e instanceof Error ? e.message : 'Failed to generate link.';
		} finally {
			creating = false;
		}
	}

	async function handleRevoke(id: string) {
		revokingId = id;
		try {
			await onRevoke(id);
		} catch (e) {
			createError = e instanceof Error ? e.message : 'Failed to revoke link.';
		} finally {
			revokingId = null;
		}
	}

	async function handleToggle(enabled: boolean) {
		toggling = true;
		toggleError = null;
		try {
			await onToggleSlug(enabled);
		} catch (e) {
			toggleError = e instanceof Error ? e.message : 'Failed to update slug invite.';
		} finally {
			toggling = false;
		}
	}
</script>

<section aria-labelledby="invite-links-heading" class="space-y-4">
	<h2 id="invite-links-heading" class="text-sm font-semibold text-on-surface">Invite Links</h2>

	<!-- Slug invite toggle -->
	<div class="rounded-lg border border-outline bg-surface-container/40 p-4 space-y-3">
		<div class="flex items-center justify-between">
			<Switch
				checked={slugInviteEnabled}
				onCheckedChange={handleToggle}
				disabled={toggling}
			>
				Enable invite via organization slug
			</Switch>
		</div>
		{#if toggleError}
			<p class="text-error text-xs">{toggleError}</p>
		{/if}
		{#if slugInviteEnabled}
			<div class="flex items-center gap-2 text-sm text-on-surface-subtle">
				<code class="font-mono text-xs bg-surface-container px-2 py-1 rounded"
					>{baseUrl}{orgSlug}</code
				>
				<CopyButton value="{baseUrl}{orgSlug}" aria-label="Copy slug invite URL" />
			</div>
		{/if}
	</div>

	<!-- Token links table -->
	{#if inviteLinks.length > 0}
		<div class="rounded-lg border border-outline overflow-hidden">
			<table class="w-full text-sm">
				<thead class="bg-surface-container text-on-surface-subtle text-left">
					<tr>
						<th class="px-4 py-3 font-medium">Token</th>
						<th class="px-4 py-3 font-medium">Created</th>
						<th class="px-4 py-3 font-medium">Expires</th>
						<th class="px-4 py-3"></th>
					</tr>
				</thead>
				<tbody class="divide-y divide-outline">
					{#each inviteLinks as link}
						<tr class="hover:bg-surface-container/50">
							<td class="px-4 py-3">
								<code class="font-mono text-xs text-on-surface">{link.id}</code>
							</td>
							<td class="px-4 py-3 text-on-surface-subtle">
								<Time timestamp={link.created_at} format="MMM DD, YYYY" />
							</td>
							<td class="px-4 py-3 text-on-surface-subtle">
								{#if link.expires_at}
									<Time timestamp={link.expires_at} format="MMM DD, YYYY" />
								{:else}
									Never
								{/if}
							</td>
							<td class="px-4 py-3">
								<div class="flex items-center justify-end gap-1">
									<CopyButton
										value="{baseUrl}{link.id}"
										aria-label="Copy invite link"
									/>
									<Button
										variant="ghost"
										size="sm"
										iconOnly
										aria-label="Revoke link"
										loading={revokingId === link.id}
										onclick={() => handleRevoke(link.id)}
									>
										<TrashIcon />
									</Button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	<!-- Generate new link -->
	<div class="space-y-2">
		<h3 class="text-xs font-medium text-on-surface-subtle uppercase tracking-wide">
			Generate New Link
		</h3>
		<div class="flex gap-2 items-center">
			<DatePicker bind:value={expiryDate} placeholder={undefined} />
			<span class="text-xs text-on-surface-subtle whitespace-nowrap">Optional expiry</span>
			<Button onclick={handleCreate} loading={creating}>
				<PlusIcon />
				Generate Link
			</Button>
		</div>
		{#if createError}
			<p class="text-error text-sm">{createError}</p>
		{/if}
	</div>
</section>
