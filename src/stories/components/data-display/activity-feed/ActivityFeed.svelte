<script lang="ts">
	import type { ActivityEntry } from '$lib/shared/types/activity';
	import { formatDateTime } from '$lib/shared/utils/format-date';

	interface Props {
		items: ActivityEntry[];
		/** Name the person in each row; off on a user's own page. */
		showUser?: boolean;
		/** Name the organization in each row; off on an org's own page. */
		showOrg?: boolean;
		/** Where a person's name links to; no links when omitted. */
		userHref?: (id: string) => string;
		orgHref?: (id: string) => string;
		emptyText?: string;
	}

	let {
		items,
		showUser = true,
		showOrg = true,
		userHref,
		orgHref,
		emptyText = 'Nothing has happened yet.'
	}: Props = $props();

	function detail(entry: ActivityEntry): string | null {
		if (entry.type === 'canvass.visit') return entry.metadata.contact_made ? 'Talked to someone' : 'No answer';
		if (entry.type === 'document.failed' && typeof entry.metadata.error === 'string') return entry.metadata.error;
		return null;
	}
</script>

{#if items.length === 0}
	<p class="px-4 py-8 text-center text-sm text-on-surface-subtle">{emptyText}</p>
{:else}
	<ol class="divide-y divide-outline-subtle">
		{#each items as entry (entry.id)}
			{@const extra = detail(entry)}
			<li class="flex flex-col gap-0.5 px-4 py-2.5 sm:flex-row sm:items-baseline sm:gap-4">
				<time datetime={entry.occurredAt} class="shrink-0 text-xs tabular-nums text-on-surface-subtle sm:w-44">
					{formatDateTime(entry.occurredAt)}
				</time>
				<p class="min-w-0 text-sm text-on-surface">
					{#if showUser && entry.userName}
						{#if userHref && entry.userId}
							<a href={userHref(entry.userId)} class="font-medium">{entry.userName}</a>
						{:else}
							<span class="font-medium">{entry.userName}</span>
						{/if}
						<span class="lowercase">{entry.label}</span>
					{:else}
						{entry.label}
					{/if}
					{#if showOrg && entry.orgName}
						<span class="text-on-surface-subtle">in</span>
						{#if orgHref && entry.orgId}
							<a href={orgHref(entry.orgId)}>{entry.orgName}</a>
						{:else}
							{entry.orgName}
						{/if}
					{/if}
					{#if extra}
						<span class="text-on-surface-subtle">. {extra}</span>
					{/if}
				</p>
			</li>
		{/each}
	</ol>
{/if}
