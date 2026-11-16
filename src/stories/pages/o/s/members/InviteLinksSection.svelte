<script lang="ts">
	import { getLocalTimeZone, type DateValue } from '@internationalized/date';
	import Time from 'svelte-time/Time.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import Switch from '$components/data-inputs/switch/Switch.svelte';
	import CopyButton from '$components/actions/copy-button/CopyButton.svelte';
	import QrCodeDialog from '$components/feedback/qr-code-dialog/QrCodeDialog.svelte';
	import ConfirmDialog from '$components/feedback/confirm-dialog/ConfirmDialog.svelte';
	import DatePicker from '$components/data-inputs/date-picker/DatePicker.svelte';
	import DataTable, {
		type DataTableColumn
	} from '$components/data-display/data-table/DataTable.svelte';
	import PlusIcon from 'phosphor-svelte/lib/Plus';
	import QrCodeIcon from 'phosphor-svelte/lib/QrCode';
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
	let dialogOpen = $state(false);
	/** The QR code being shown, if any: what it holds and how its modal and download are named. */
	let qr = $state<{ value: string; title: string; filename: string } | null>(null);

	function showLinkQr(link: InviteLink) {
		qr = {
			value: `${baseUrl}${link.id}`,
			title: 'Invite link QR code',
			filename: 'invite-link-qr.png'
		};
	}

	function showSlugQr() {
		qr = {
			value: `${baseUrl}${orgSlug}`,
			title: 'Organization invite QR code',
			filename: `${orgSlug}-invite-qr.png`
		};
	}
	let createError = $state<string | null>(null);
	let revokeError = $state<string | null>(null);
	let revokingId = $state<string | null>(null);
	let toggling = $state(false);
	let toggleError = $state<string | null>(null);

	/** The last second of the chosen day where the user is, so the link lasts through that day. */
	function endOfDay(date: DateValue): string {
		const nextDay = date.add({ days: 1 }).toDate(getLocalTimeZone());
		return new Date(nextDay.getTime() - 1000).toISOString();
	}

	function openDialog() {
		expiryDate = undefined;
		createError = null;
		dialogOpen = true;
	}

	function closeDialog() {
		dialogOpen = false;
		expiryDate = undefined;
		createError = null;
	}

	async function handleCreate() {
		creating = true;
		createError = null;
		try {
			await onCreate(expiryDate ? endOfDay(expiryDate) : null);
			closeDialog();
		} catch (e) {
			createError = e instanceof Error ? e.message : 'Failed to generate link.';
		} finally {
			creating = false;
		}
	}

	async function handleRevoke(id: string) {
		revokingId = id;
		revokeError = null;
		try {
			await onRevoke(id);
		} catch (e) {
			revokeError = e instanceof Error ? e.message : 'Failed to revoke link.';
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

	const columns: DataTableColumn<InviteLink>[] = [
		{ id: 'token', header: 'Token', cell: tokenCell },
		{ id: 'created', header: 'Created', class: 'text-on-surface-subtle', cell: createdCell },
		{ id: 'expires', header: 'Expires', class: 'text-on-surface-subtle', cell: expiresCell },
		{ id: 'actions', header: 'Actions', srOnlyHeader: true, align: 'right', cell: actionsCell }
	];
</script>

{#snippet tokenCell({ row: link }: { row: InviteLink })}
	<code class="font-mono text-xs text-on-surface">{link.id}</code>
{/snippet}

{#snippet createdCell({ row: link }: { row: InviteLink })}
	<Time timestamp={link.created_at} format="MMM DD, YYYY" />
{/snippet}

{#snippet expiresCell({ row: link }: { row: InviteLink })}
	{#if link.expires_at}
		<Time timestamp={link.expires_at} format="MMM DD, YYYY" />
	{:else}
		Never
	{/if}
{/snippet}

{#snippet actionsCell({ row: link }: { row: InviteLink })}
	<div class="flex items-center justify-end gap-1">
		<Button
			variant="ghost"
			size="sm"
			iconOnly
			aria-label="Show QR code"
			onclick={() => showLinkQr(link)}
		>
			<QrCodeIcon />
		</Button>
		<CopyButton value="{baseUrl}{link.id}" aria-label="Copy invite link" />
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
{/snippet}

<section aria-labelledby="invite-links-heading" class="space-y-4">
	<div class="flex items-center justify-between gap-3">
		<h2 id="invite-links-heading" class="text-sm font-semibold text-on-surface">Invite Links</h2>
		<Button onclick={openDialog}>
			<PlusIcon />
			Generate Link
		</Button>
	</div>

	<!-- Slug invite toggle -->
	<div class="rounded-lg border border-outline bg-surface-container/40 p-4 space-y-3">
		<div class="flex items-center justify-between">
			<Switch checked={slugInviteEnabled} onCheckedChange={handleToggle} disabled={toggling}>
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
				<Button
					variant="ghost"
					size="sm"
					iconOnly
					aria-label="Show slug invite QR code"
					onclick={showSlugQr}
				>
					<QrCodeIcon />
				</Button>
				<CopyButton value="{baseUrl}{orgSlug}" aria-label="Copy slug invite URL" />
			</div>
		{/if}
	</div>

	<!-- Token links table -->
	{#if inviteLinks.length > 0}
		<DataTable data={inviteLinks} {columns} getRowId={(link) => link.id} label="Invite links" />
	{/if}

	{#if revokeError}
		<p role="alert" class="text-error text-sm">{revokeError}</p>
	{/if}
</section>

<ConfirmDialog
	open={dialogOpen}
	title="Generate invite link"
	description="Choose the last day the link works, or leave it blank for a link that never expires."
	confirmLabel="Generate Link"
	loading={creating}
	error={createError}
	onConfirm={handleCreate}
	onCancel={closeDialog}
>
	<div class="flex flex-col gap-1.5">
		<span class="text-sm font-medium text-on-surface">Expiration date (optional)</span>
		<DatePicker bind:value={expiryDate} placeholder={undefined} />
	</div>
</ConfirmDialog>

<QrCodeDialog
	open={qr !== null}
	value={qr?.value ?? ''}
	title={qr?.title ?? 'QR code'}
	filename={qr?.filename ?? 'qr-code.png'}
	onClose={() => (qr = null)}
/>
