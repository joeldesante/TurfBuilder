<script lang="ts">
	import Badge from '$components/data-display/badge/Badge.svelte';
	import type { EmailLogEntry } from '$lib/shared/types/activity';
	import { formatDateTime } from '$lib/shared/utils/format-date';

	interface Props {
		items: EmailLogEntry[];
		/** Show who each email went to; off on a user's own page. */
		showRecipient?: boolean;
		emptyText?: string;
	}

	let { items, showRecipient = true, emptyText = 'No emails sent.' }: Props = $props();

	const STATUS: Record<EmailLogEntry['status'], { label: string; variant: 'success' | 'warning' | 'error' }> = {
		sent: { label: 'Sent', variant: 'success' },
		skipped: { label: 'Not sent', variant: 'warning' },
		failed: { label: 'Failed', variant: 'error' }
	};
</script>

{#if items.length === 0}
	<p class="px-4 py-8 text-center text-sm text-on-surface-subtle">{emptyText}</p>
{:else}
	<div class="overflow-x-auto">
		<table class="w-full text-sm">
			<thead class="text-left text-on-surface-subtle">
				<tr class="border-b border-outline-subtle">
					<th scope="col" class="px-4 py-2 font-medium">Sent</th>
					{#if showRecipient}<th scope="col" class="px-4 py-2 font-medium">To</th>{/if}
					<th scope="col" class="px-4 py-2 font-medium">Email</th>
					<th scope="col" class="px-4 py-2 font-medium">Status</th>
				</tr>
			</thead>
			<tbody>
				{#each items as email (email.id)}
					<tr class="border-b border-outline-subtle align-top last:border-0">
						<td class="whitespace-nowrap px-4 py-2.5 tabular-nums text-on-surface-subtle">
							<time datetime={email.createdAt}>{formatDateTime(email.createdAt)}</time>
						</td>
						{#if showRecipient}<td class="px-4 py-2.5 break-all">{email.recipient}</td>{/if}
						<td class="px-4 py-2.5">
							<span class="block text-on-surface">{email.subject ?? email.template}</span>
							<span class="block font-mono text-xs text-on-surface-subtle">{email.template}</span>
						</td>
						<td class="px-4 py-2.5">
							<Badge size="sm" variant={STATUS[email.status].variant}>{STATUS[email.status].label}</Badge>
							{#if email.error}
								<span class="mt-1 block max-w-xs text-xs break-words text-on-surface-subtle">{email.error}</span>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
