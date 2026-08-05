<script lang="ts" module>
	export interface SuggestionRow {
		id: string;
		entity_id: string;
		created_at: string;
		submitted_by: string | null;
		turf_code: string | null;
		name: string | null;
		address_line_1: string | null;
		address_line_2: string | null;
		city: string | null;
		state_or_region: string | null;
		postal_code: string | null;
		country_code: string | null;
		latitude: number | null;
		longitude: number | null;
		photo_keys: string[];
	}

	export interface EditRow {
		id: string;
		created_at: string;
		submitted_by: string | null;
		turf_code: string | null;
		note: string | null;
		photo_keys: string[];
		is_public_location: boolean;
		moves_pin: boolean;
		latitude: number | null;
		longitude: number | null;
		current_name: string | null;
		current_address_line_1: string | null;
		current_address_line_2: string | null;
		current_city: string | null;
		current_state_or_region: string | null;
		current_postal_code: string | null;
		current_country_code: string | null;
		name: string | null;
		address_line_1: string | null;
		address_line_2: string | null;
		city: string | null;
		state_or_region: string | null;
		postal_code: string | null;
		country_code: string | null;
	}

	export interface Props {
		orgSlug: string;
		suggestions: SuggestionRow[];
		edits?: EditRow[];
		canApprove?: boolean;
		canReject?: boolean;
		canReviewEdits?: boolean;
		onApprove?: (id: string) => Promise<void>;
		onReject?: (id: string) => Promise<void>;
		onApproveEdit?: (id: string) => Promise<void>;
		onRejectEdit?: (id: string) => Promise<void>;
	}

	/** Field labels paired with their current and proposed column names. */
	const EDIT_FIELDS = [
		['Name', 'current_name', 'name'],
		['Street address', 'current_address_line_1', 'address_line_1'],
		['Unit or suite', 'current_address_line_2', 'address_line_2'],
		['City', 'current_city', 'city'],
		['State or region', 'current_state_or_region', 'state_or_region'],
		['Postal code', 'current_postal_code', 'postal_code'],
		['Country', 'current_country_code', 'country_code']
	] as const;
</script>

<script lang="ts">
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import Badge from '$components/data-display/badge/Badge.svelte';
	import ConfirmDialog from '$components/feedback/confirm-dialog/ConfirmDialog.svelte';
	import CheckIcon from 'phosphor-svelte/lib/Check';
	import XIcon from 'phosphor-svelte/lib/X';
	import ImageSquareIcon from 'phosphor-svelte/lib/ImageSquare';

	const {
		orgSlug,
		suggestions,
		edits = [],
		canApprove = false,
		canReject = false,
		canReviewEdits = false,
		onApprove,
		onReject,
		onApproveEdit,
		onRejectEdit
	}: Props = $props();

	/** Only the fields a canvasser actually proposed changing. */
	function changedFields(edit: EditRow) {
		return EDIT_FIELDS.filter(([, , proposed]) => edit[proposed] !== null).map(
			([label, currentKey, proposedKey]) => ({
				label,
				from: edit[currentKey],
				to: edit[proposedKey]
			})
		);
	}

	let busyId = $state<string | null>(null);
	let rejecting = $state<SuggestionRow | null>(null);
	let rejectError = $state<string | null>(null);
	let rejectBusy = $state(false);
	let listError = $state<string | null>(null);

	function formatAddress(row: SuggestionRow): string {
		return [row.address_line_1, row.address_line_2, row.city, row.state_or_region, row.postal_code]
			.filter(Boolean)
			.join(', ');
	}

	function formatSubmitted(
		row: Pick<SuggestionRow, 'submitted_by' | 'created_at' | 'turf_code'>
	): string {
		const who = row.submitted_by ?? 'A volunteer';
		const when = new Date(row.created_at).toLocaleDateString();
		return row.turf_code ? `${who} on turf ${row.turf_code}, ${when}` : `${who}, ${when}`;
	}

	async function approve(row: SuggestionRow) {
		busyId = row.id;
		listError = null;
		try {
			await onApprove?.(row.id);
		} catch (e) {
			listError = e instanceof Error ? e.message : 'Could not approve this location.';
		} finally {
			busyId = null;
		}
	}

	let rejectingEdit = $state<EditRow | null>(null);

	async function approveEdit(edit: EditRow) {
		busyId = edit.id;
		listError = null;
		try {
			await onApproveEdit?.(edit.id);
		} catch (e) {
			listError = e instanceof Error ? e.message : 'Could not apply this correction.';
		} finally {
			busyId = null;
		}
	}

	async function confirmRejectEdit() {
		const target = rejectingEdit;
		if (!target) return;
		rejectBusy = true;
		rejectError = null;
		try {
			await onRejectEdit?.(target.id);
			rejectingEdit = null;
		} catch (e) {
			rejectError = e instanceof Error ? e.message : 'Could not decline this correction.';
		} finally {
			rejectBusy = false;
		}
	}

	async function confirmReject() {
		const target = rejecting;
		if (!target) return;
		rejectBusy = true;
		rejectError = null;
		try {
			await onReject?.(target.id);
			rejecting = null;
		} catch (e) {
			rejectError = e instanceof Error ? e.message : 'Could not reject this location.';
		} finally {
			rejectBusy = false;
		}
	}
</script>

<PageHeader
	title="Pending locations"
	subheading="Additions and corrections from canvassers in the field, waiting on your review."
/>

{#if listError}
	<p role="alert" class="border-t border-outline-subtle px-4 py-3 text-sm text-error">
		{listError}
	</p>
{/if}

<h2 class="border-t border-outline-subtle px-4 pt-4 pb-2 text-sm font-semibold text-on-surface">
	New businesses
	<span class="ml-1 font-normal text-on-surface-subtle">({suggestions.length})</span>
</h2>

<div>
	{#each suggestions as suggestion (suggestion.id)}
		<div class="flex flex-col gap-4 border-b border-outline-subtle px-4 py-4 sm:flex-row">
			<div class="min-w-0 flex-1">
				<div class="flex flex-wrap items-center gap-2">
					<h3 class="text-sm font-semibold text-on-surface">
						{suggestion.name ?? 'Unnamed business'}
					</h3>
					<Badge variant="warning" size="sm">Tentative</Badge>
				</div>
				{#if formatAddress(suggestion)}
					<p class="mt-0.5 text-sm text-on-surface-variant">{formatAddress(suggestion)}</p>
				{/if}
				<p class="mt-1 text-xs text-on-surface-subtle">{formatSubmitted(suggestion)}</p>

				{#if suggestion.photo_keys.length > 0}
					<ul class="mt-3 flex flex-wrap gap-2">
						{#each suggestion.photo_keys as key (key)}
							<li>
								<a href="/o/{orgSlug}/uploads/{key}" target="_blank" rel="noreferrer">
									<img
										src="/o/{orgSlug}/uploads/{key}"
										alt="Photo submitted with {suggestion.name ?? 'this business'}"
										class="size-24 rounded-md border border-outline-subtle object-cover"
									/>
								</a>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="mt-3 flex items-center gap-1.5 text-xs text-on-surface-subtle">
						<ImageSquareIcon size={14} />
						No photos submitted
					</p>
				{/if}
			</div>

			<div class="flex shrink-0 items-start gap-2">
				{#if canApprove}
					<Button
						variant="primary"
						size="sm"
						loading={busyId === suggestion.id}
						onclick={() => approve(suggestion)}
					>
						<CheckIcon />
						Approve
					</Button>
				{/if}
				{#if canReject}
					<Button
						variant="ghost"
						size="sm"
						onclick={() => {
							rejecting = suggestion;
							rejectError = null;
						}}
					>
						<XIcon />
						Reject
					</Button>
				{/if}
			</div>
		</div>
	{:else}
		<p class="px-4 py-8 text-center text-sm text-on-surface-subtle">
			No new businesses are waiting for review.
		</p>
	{/each}
</div>

<h2 class="border-t border-outline-subtle px-4 pt-6 pb-2 text-sm font-semibold text-on-surface">
	Corrections
	<span class="ml-1 font-normal text-on-surface-subtle">({edits.length})</span>
</h2>

<div>
	{#each edits as edit (edit.id)}
		<div class="flex flex-col gap-4 border-b border-outline-subtle px-4 py-4 sm:flex-row">
			<div class="min-w-0 flex-1">
				<div class="flex flex-wrap items-center gap-2">
					<h3 class="text-sm font-semibold text-on-surface">
						{edit.current_name ?? 'Unnamed location'}
					</h3>
					{#if edit.is_public_location}
						<Badge variant="info" size="sm">Shared record</Badge>
					{/if}
				</div>
				<p class="mt-1 text-xs text-on-surface-subtle">{formatSubmitted(edit)}</p>

				{#if edit.note}
					<p class="mt-2 text-sm text-on-surface-variant">"{edit.note}"</p>
				{/if}

				<dl class="mt-3 space-y-1 text-sm">
					{#each changedFields(edit) as field (field.label)}
						<div class="flex flex-wrap items-baseline gap-x-2">
							<dt class="text-xs text-on-surface-subtle">{field.label}</dt>
							<dd class="flex flex-wrap items-baseline gap-2">
								<span class="text-on-surface-subtle line-through">{field.from ?? 'blank'}</span>
								<span aria-hidden="true" class="text-on-surface-subtle">&rarr;</span>
								<span class="font-medium text-on-surface">{field.to}</span>
							</dd>
						</div>
					{:else}
						{#if !edit.moves_pin}
							<p class="text-on-surface-subtle">No field changes proposed.</p>
						{/if}
					{/each}
					{#if edit.moves_pin}
						<div class="flex flex-wrap items-baseline gap-x-2">
							<dt class="text-xs text-on-surface-subtle">Pin</dt>
							<dd class="font-medium text-on-surface">
								Moved to {edit.latitude?.toFixed(5)}, {edit.longitude?.toFixed(5)}
							</dd>
						</div>
					{/if}
				</dl>

				{#if edit.is_public_location}
					<p class="mt-2 text-xs text-on-surface-subtle">
						This location comes from the shared dataset. Approving creates a copy owned by your
						organization; other organizations keep the original.
					</p>
				{/if}

				{#if edit.photo_keys.length > 0}
					<ul class="mt-3 flex flex-wrap gap-2">
						{#each edit.photo_keys as key (key)}
							<li>
								<a href="/o/{orgSlug}/uploads/{key}" target="_blank" rel="noreferrer">
									<img
										src="/o/{orgSlug}/uploads/{key}"
										alt="Evidence submitted for {edit.current_name ?? 'this location'}"
										class="size-24 rounded-md border border-outline-subtle object-cover"
									/>
								</a>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="mt-3 flex items-center gap-1.5 text-xs text-on-surface-subtle">
						<ImageSquareIcon size={14} />
						No evidence photos submitted
					</p>
				{/if}
			</div>

			{#if canReviewEdits}
				<div class="flex shrink-0 items-start gap-2">
					<Button
						variant="primary"
						size="sm"
						loading={busyId === edit.id}
						onclick={() => approveEdit(edit)}
					>
						<CheckIcon />
						Apply
					</Button>
					<Button
						variant="ghost"
						size="sm"
						onclick={() => {
							rejectingEdit = edit;
							rejectError = null;
						}}
					>
						<XIcon />
						Decline
					</Button>
				</div>
			{/if}
		</div>
	{:else}
		<p class="px-4 py-8 text-center text-sm text-on-surface-subtle">
			No corrections are waiting for review.
		</p>
	{/each}
</div>

<ConfirmDialog
	open={rejectingEdit !== null}
	title="Decline this correction?"
	description="The location keeps its current details. The report is kept so you can see what was raised."
	confirmLabel="Decline"
	destructive
	loading={rejectBusy}
	error={rejectError}
	onConfirm={confirmRejectEdit}
	onCancel={() => (rejectingEdit = null)}
/>

<ConfirmDialog
	open={rejecting !== null}
	title="Reject this location?"
	description={rejecting
		? `${rejecting.name ?? 'This business'} will be deleted outright, along with any canvassing response recorded against it. This cannot be undone.`
		: ''}
	confirmLabel="Reject and delete"
	destructive
	loading={rejectBusy}
	error={rejectError}
	onConfirm={confirmReject}
	onCancel={() => (rejecting = null)}
/>
