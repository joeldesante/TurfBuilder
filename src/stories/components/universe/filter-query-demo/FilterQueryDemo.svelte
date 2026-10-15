<script lang="ts">
	import Dropdown from '$components/data-inputs/dropdown/Dropdown.svelte';
	import EntityFilterEditor from '$components/universe/entity-filter-editor/EntityFilterEditor.svelte';
	import type { FilterSource } from '$lib/client/filter-source';
	import { buildFilterQuery } from '$lib/server/services/filters.service';
	import type { FilterEntity, FilterQuery } from '$lib/server/services/filters.service';
	import type { FilterGroup } from '$lib/shared/types/filters';
	import { formatSql } from './format-sql';
	import { highlightSql, type SqlTokenKind } from './highlight-sql';

	interface Props {
		/** Which records the query is built for; decides which filters apply. */
		entity?: FilterEntity;
		/** The tree the editor starts with. */
		group?: FilterGroup;
	}

	let {
		entity = $bindable('locations'),
		group = $bindable({ operator: 'AND', filters: [] })
	}: Props = $props();

	// Stands in for the API so the survey filter's pickers have something to offer.
	const source: FilterSource = {
		listBuckets: async () => [
			{ id: '11111111-1111-4111-8111-111111111111', name: 'Philadelphia voters' }
		],
		listLists: async () => [
			{ id: '44444444-4444-4444-8444-444444444444', name: 'Ward 3 doors', entity_type: 'locations' }
		],
		listSurveys: async () => [
			{ id: '22222222-2222-4222-8222-222222222222', name: 'Spring canvass' }
		],
		listQuestions: async () => [
			{
				id: '33333333-3333-4333-8333-333333333333',
				question_text: 'Will you vote for the measure?',
				question_type: 'radio',
				choices: ['Yes', 'No', 'Undecided']
			}
		]
	};

	const json = $derived(JSON.stringify(group, null, 2));

	/** The query the document compiles to, or the reason it does not. */
	const result = $derived.by<{ query: FilterQuery } | { problem: string }>(() => {
		try {
			return { query: buildFilterQuery(entity, $state.snapshot(group)) };
		} catch (e) {
			const body = (e as { body?: { message?: string } }).body;
			return { problem: body?.message ?? 'The filter could not be compiled.' };
		}
	});

	const sqlTokens = $derived('query' in result ? highlightSql(formatSql(result.query.sql)) : []);

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

<div class="grid gap-6 p-4 lg:grid-cols-2">
	<section class="min-w-0 space-y-4">
		<div class="flex items-center gap-3">
			<h2 class="text-lg font-semibold text-on-surface">Filters</h2>
			<Dropdown
				aria-label="Entity type"
				items={[
					{ value: 'locations', label: 'Locations' },
					{ value: 'people', label: 'People' }
				]}
				value={entity}
				onValueChange={(next) => (entity = next as FilterEntity)}
			/>
		</div>

		<EntityFilterEditor bind:group {source} {entity} />
	</section>

	<div class="min-w-0 space-y-6">
		<section class="space-y-2">
			<h2 class="text-lg font-semibold text-on-surface">JSON</h2>
			<p class="text-sm text-on-surface-subtle">
				What the editor produces. This is what gets stored.
			</p>
			<pre
				aria-label="Filter JSON"
				class="max-h-96 overflow-auto rounded-lg border border-outline-subtle bg-surface-container p-3 font-mono text-xs text-on-surface">{json}</pre>
		</section>

		<section class="space-y-2">
			<h2 class="text-lg font-semibold text-on-surface">SQL</h2>
			{#if 'query' in result}
				<p class="text-sm text-on-surface-subtle">
					What the server runs for {entity}. Values are sent as parameters, never in the text.
				</p>
				<pre
					aria-label="Generated SQL"
					class="max-h-[32rem] overflow-auto whitespace-pre rounded-lg border border-outline-subtle bg-surface-container p-3 font-mono text-xs text-on-surface [tab-size:2]">{#each sqlTokens as token, i (i)}{#if token.kind === 'plain'}{token.text}{:else}<span
								class={TOKEN_CLASS[token.kind]}>{token.text}</span
							>{/if}{/each}</pre>

				{#if result.query.params.length > 0}
					<ul aria-label="Query parameters" class="space-y-1 font-mono text-xs text-on-surface">
						{#each result.query.params as value, i (i)}
							<li class="break-all">
								<span class="text-on-surface-subtle">${i + 1} =</span>
								{show(value)}
							</li>
						{/each}
					</ul>
				{/if}
			{:else}
				<p role="alert" class="rounded-lg border border-error p-3 text-sm text-error">
					{result.problem}
				</p>
			{/if}
		</section>
	</div>
</div>
