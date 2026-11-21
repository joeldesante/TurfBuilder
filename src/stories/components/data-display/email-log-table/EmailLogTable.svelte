<script lang="ts">
	import Badge from '$components/data-display/badge/Badge.svelte';
	import DataTable, {
		type DataTableColumn
	} from '$components/data-display/data-table/DataTable.svelte';
	import type { EmailLogEntry } from '$lib/shared/types/activity';
	import { formatDateTime } from '$lib/shared/utils/format-date';

	interface Props {
		items: EmailLogEntry[];
		/** Show who each email went to; off on a user's own page. */
		showRecipient?: boolean;
		emptyText?: string;
	}

	let { items, showRecipient = true, emptyText = 'No emails sent.' }: Props = $props();

	const STATUS: Record<
		EmailLogEntry['status'],
		{ label: string; variant: 'success' | 'warning' | 'error' }
	> = {
		sent: { label: 'Sent', variant: 'success' },
		skipped: { label: 'Not sent', variant: 'warning' },
		failed: { label: 'Failed', variant: 'error' }
	};

	const columns = $derived<DataTableColumn<EmailLogEntry>[]>([
		{
			id: 'sent',
			header: 'Sent',
			cell: sentCell,
			nowrap: true,
			tabular: true,
			class: 'text-on-surface-subtle'
		},
		...(showRecipient
			? [{ id: 'recipient', header: 'To', cell: recipientCell, class: 'break-all' }]
			: []),
		{ id: 'email', header: 'Email', cell: emailCell },
		{ id: 'status', header: 'Status', cell: statusCell }
	]);
</script>

{#snippet sentCell({ row }: { value: unknown; row: EmailLogEntry })}
	<time datetime={row.createdAt}>{formatDateTime(row.createdAt)}</time>
{/snippet}

{#snippet recipientCell({ row }: { value: unknown; row: EmailLogEntry })}
	{row.recipient}
{/snippet}

{#snippet emailCell({ row }: { value: unknown; row: EmailLogEntry })}
	<span class="block text-on-surface">{row.subject ?? row.template}</span>
	<span class="block font-mono text-xs text-on-surface-subtle">{row.template}</span>
{/snippet}

{#snippet statusCell({ row }: { value: unknown; row: EmailLogEntry })}
	<Badge size="sm" variant={STATUS[row.status].variant}>{STATUS[row.status].label}</Badge>
	{#if row.error}
		<span class="mt-1 block max-w-xs text-xs break-words text-on-surface-subtle">{row.error}</span>
	{/if}
{/snippet}

<DataTable
	data={items}
	{columns}
	getRowId={(email) => email.id}
	empty={emptyText}
	label="Emails"
	bordered={false}
/>
