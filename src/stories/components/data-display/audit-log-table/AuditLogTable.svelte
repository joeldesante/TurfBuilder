<script lang="ts">
	import type { AuditEntry } from '$lib/shared/types/audit';
	import { auditActionLabel } from '$lib/shared/registries/audit-actions';
	import { formatDateTime } from '$lib/shared/utils/format-date';

	interface Props {
		items: AuditEntry[];
		/** Show what each change was made to; off on a target's own page. */
		showTarget?: boolean;
		/** Where a target links to, by type and id; plain text when it returns null. */
		targetHref?: (type: AuditEntry['targetType'], id: string) => string | null;
		emptyText?: string;
	}

	let { items, showTarget = true, targetHref, emptyText = 'No changes recorded.' }: Props = $props();

	const hidden = new Set(['changes']);

	function targetLinkText(entry: AuditEntry): string {
		if (entry.targetType === 'user') return 'View user';
		if (entry.targetType === 'organization') return 'View organization';
		return entry.targetId ?? '';
	}

	function summary(entry: AuditEntry): string[] {
		const lines: string[] = [];
		const changes = entry.metadata.changes;
		if (Array.isArray(changes)) {
			for (const c of changes as { key: string; from: unknown; to: unknown }[]) {
				lines.push(`${c.key}: ${String(c.from ?? '')} to ${String(c.to ?? '')}`);
			}
		} else if (changes && typeof changes === 'object') {
			for (const [key, c] of Object.entries(changes as Record<string, { from: unknown; to: unknown }>)) {
				lines.push(`${key}: ${String(c.from ?? '')} to ${String(c.to ?? '')}`);
			}
		}
		for (const [key, value] of Object.entries(entry.metadata)) {
			if (hidden.has(key) || value === null || value === undefined || typeof value === 'object') continue;
			lines.push(`${key}: ${String(value)}`);
		}
		return lines;
	}
</script>

{#if items.length === 0}
	<p class="px-4 py-8 text-center text-sm text-on-surface-subtle">{emptyText}</p>
{:else}
	<ul class="divide-y divide-outline-subtle">
		{#each items as entry (entry.id)}
			{@const lines = summary(entry)}
			{@const href = entry.targetId && targetHref ? targetHref(entry.targetType, entry.targetId) : null}
			<li class="px-4 py-3">
				<div class="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-4">
					<time datetime={entry.createdAt} class="shrink-0 text-xs tabular-nums text-on-surface-subtle sm:w-44">
						{formatDateTime(entry.createdAt)}
					</time>
					<p class="min-w-0 text-sm text-on-surface">
						<span class="font-medium">{entry.actorName ?? 'A removed admin'}</span>
						<span class="lowercase">{auditActionLabel(entry.action)}</span>
						{#if showTarget && entry.targetId}
							{#if href}
								<span class="text-on-surface-subtle">.</span>
								<a {href} class="break-all">{targetLinkText(entry)}</a>
							{:else}
								<span class="break-all text-on-surface-subtle">{entry.targetId}</span>
							{/if}
						{/if}
					</p>
				</div>
				{#if lines.length > 0}
					<details class="mt-1 sm:ml-48">
						<summary class="cursor-pointer text-xs text-on-surface-subtle">Details</summary>
						<ul class="mt-1 space-y-0.5 text-xs text-on-surface-subtle">
							{#each lines as line, i (i)}
								<li class="break-words">{line}</li>
							{/each}
							{#if entry.ip}<li>From {entry.ip}</li>{/if}
						</ul>
					</details>
				{/if}
			</li>
		{/each}
	</ul>
{/if}
