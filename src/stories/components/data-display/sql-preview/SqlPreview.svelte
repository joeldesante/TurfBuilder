<script lang="ts">
	import { formatSql } from '$lib/shared/utils/format-sql';
	import { highlightSql, type SqlTokenKind } from '$lib/shared/utils/highlight-sql';

	interface Props {
		/** A parameterized query, laid out and colored for reading. */
		sql: string;
		/** The values for `$1`, `$2`, ... listed under the query. */
		params?: unknown[];
		/** Accessible name of the query block. */
		label?: string;
	}

	const { sql, params = [], label = 'Generated SQL' }: Props = $props();

	const tokens = $derived(highlightSql(formatSql(sql)));

	/** IDE-style colors, from theme roles so they follow light and dark mode. */
	const TOKEN_CLASS: Record<SqlTokenKind, string> = {
		keyword: 'font-bold text-info',
		function: 'text-tertiary',
		type: 'italic text-warning',
		string: 'text-success',
		number: 'text-warning',
		param: 'font-semibold text-primary',
		punctuation: 'text-on-surface-subtle',
		plain: ''
	};

	function show(value: unknown): string {
		return typeof value === 'string' ? `'${value}'` : String(value);
	}
</script>

<div class="space-y-2">
	<pre
		aria-label={label}
		class="max-h-[32rem] overflow-auto whitespace-pre rounded-lg border border-outline-subtle bg-surface-container p-3 font-mono text-xs text-on-surface [tab-size:2]">{#each tokens as token, i (i)}{#if token.kind === 'plain'}{token.text}{:else}<span
					class={TOKEN_CLASS[token.kind]}>{token.text}</span
				>{/if}{/each}</pre>

	{#if params.length > 0}
		<ul aria-label="Query parameters" class="space-y-1 font-mono text-xs text-on-surface">
			{#each params as value, i (i)}
				<li class="break-all">
					<span class="text-on-surface-subtle">${i + 1} =</span>
					{show(value)}
				</li>
			{/each}
		</ul>
	{/if}
</div>
