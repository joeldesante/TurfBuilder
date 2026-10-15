<script lang="ts">
	import { untrack } from 'svelte';
	import Dropdown from '$components/data-inputs/dropdown/Dropdown.svelte';
	import Textarea from '$components/data-inputs/textarea/Textarea.svelte';
	import SqlPreview from '$components/data-display/sql-preview/SqlPreview.svelte';
	import EntityFilterEditor from '$components/universe/entity-filter-editor/EntityFilterEditor.svelte';
	import { convertBucketFilter } from '$lib/server/filter-converter';
	import type { BucketFilterInput, StoredBucketFilter } from '$lib/server/filter-converter';
	import { buildFilterQuery, convertLegacyBucketFilter } from '$lib/server/services/filters.service';
	import type { FilterQuery } from '$lib/server/services/filters.service';
	import type { BucketFilters, FilterEntity } from '$lib/shared/types/filters';

	interface Props {
		/** The old filter, as the old bucket form sent it. */
		input?: BucketFilterInput;
	}

	const { input }: Props = $props();

	const off = { enabled: false, matchType: 'ONE_OR_MORE' as const, conditions: [] };
	const condition = (filterId: string, qualifierId: string, value = '') => ({
		filterId,
		qualifierId,
		value
	});

	/** Old filters worth seeing converted, including the ones that need a closer look. */
	const PRESETS: Record<string, { label: string; input: BucketFilterInput }> = {
		city: {
			label: 'City is Austin',
			input: {
				people: off,
				locations: { enabled: true, matchType: 'ALL', conditions: [condition('city', 'is', 'Austin')] }
			}
		},
		none: {
			label: 'None of these (stored as failing at least one)',
			input: {
				people: off,
				locations: {
					enabled: true,
					matchType: 'NONE',
					conditions: [condition('city', 'is', 'Austin'), condition('zip_code', 'starts_with', '787')]
				}
			}
		},
		adults: {
			label: 'Adults with an email',
			input: {
				people: {
					enabled: true,
					matchType: 'ALL',
					conditions: [condition('age', 'gte', '18'), condition('has_email', '')]
				},
				locations: off
			}
		},
		names: {
			label: 'Either name contains',
			input: {
				people: {
					enabled: true,
					matchType: 'ONE_OR_MORE',
					conditions: [condition('first_name', 'contains', 'al'), condition('last_name', 'starts_with', 'Sm')]
				},
				locations: off
			}
		},
		both: {
			label: 'People and locations',
			input: {
				people: { enabled: true, matchType: 'ALL', conditions: [condition('dob', 'before', '1960-01-01')] },
				locations: { enabled: true, matchType: 'ALL', conditions: [] }
			}
		},
		wildcard: {
			label: 'Cannot convert: a % in the text',
			input: {
				people: off,
				locations: { enabled: true, matchType: 'ALL', conditions: [condition('city', 'contains', '50%')] }
			}
		}
	};

	// The starting old filter is read once; after that the textarea is the source.
	let preset = $state(untrack(() => (input ? '' : 'city')));
	let text = $state(untrack(() => JSON.stringify(input ?? PRESETS.city.input, null, 2)));

	function choose(key: string) {
		preset = key;
		text = JSON.stringify(PRESETS[key].input, null, 2);
	}

	type Outcome =
		| { stage: 'input'; problem: string }
		| { stage: 'conversion'; problem: string; stored: StoredBucketFilter }
		| {
				stage: 'done';
				stored: StoredBucketFilter;
				converted: BucketFilters;
				queries: { entity: FilterEntity; query: FilterQuery | null; problem: string | null }[];
		  };

	/** Runs the old filter through the same steps a bucket goes through when it is converted. */
	const outcome = $derived.by<Outcome>(() => {
		let parsed: BucketFilterInput;
		try {
			parsed = JSON.parse(text);
			if (!parsed?.people || !parsed?.locations) throw new Error('It needs both people and locations.');
		} catch (e) {
			return { stage: 'input', problem: e instanceof Error ? e.message : 'That is not valid JSON.' };
		}

		// What the old code saved in universe.bucket.filter.
		let stored: StoredBucketFilter;
		try {
			stored = convertBucketFilter(parsed);
		} catch (e) {
			return { stage: 'input', problem: e instanceof Error ? e.message : 'The old form could not be read.' };
		}

		let converted: BucketFilters;
		try {
			converted = convertLegacyBucketFilter(stored);
		} catch (e) {
			return { stage: 'conversion', stored, problem: e instanceof Error ? e.message : String(e) };
		}

		const queries = (['people', 'locations'] as const)
			.filter((entity) => converted[entity] !== null)
			.map((entity) => {
				try {
					return { entity, query: buildFilterQuery(entity, converted[entity]), problem: null };
				} catch (e) {
					const body = (e as { body?: { message?: string } }).body;
					return { entity, query: null, problem: body?.message ?? 'The filter could not be compiled.' };
				}
			});

		return { stage: 'done', stored, converted, queries };
	});

	const json = (value: unknown) => JSON.stringify(value, null, 2);
	const LABELS: Record<FilterEntity, string> = { people: 'People', locations: 'Locations' };
</script>

<div class="grid gap-6 p-4 lg:grid-cols-2">
	<section class="min-w-0 space-y-3">
		<div class="flex flex-wrap items-center gap-3">
			<h2 class="text-lg font-semibold text-on-surface">Old filter</h2>
			<Dropdown
				aria-label="Example"
				placeholder="Choose an example"
				items={Object.entries(PRESETS).map(([value, p]) => ({ value, label: p.label }))}
				value={preset}
				onValueChange={choose}
			/>
		</div>
		<p class="text-sm text-on-surface-subtle">
			What the old bucket form sent: conditions per kind of record, combined by a match type
			(<code>ALL</code>, <code>ONE_OR_MORE</code>, or <code>NONE</code>). Edit it to try others.
		</p>
		<Textarea
			aria-label="Old filter"
			rows={22}
			class="font-mono text-xs"
			value={text}
			oninput={(e: Event) => {
				text = (e.currentTarget as HTMLTextAreaElement).value;
				preset = '';
			}}
		/>

		{#if outcome.stage !== 'input'}
			<h3 class="text-sm font-medium text-on-surface">Stored in <code>filter</code></h3>
			<p class="text-sm text-on-surface-subtle">
				The compiled query the old code saved. This is what the conversion reads.
			</p>
			<pre
				aria-label="Stored old filter"
				class="max-h-72 overflow-auto rounded-lg border border-outline-subtle bg-surface-container p-3 font-mono text-xs text-on-surface">{json(outcome.stored)}</pre>
		{/if}
	</section>

	<div class="min-w-0 space-y-6">
		{#if outcome.stage === 'input'}
			<p role="alert" class="rounded-lg border border-error p-3 text-sm text-error">
				{outcome.problem}
			</p>
		{:else if outcome.stage === 'conversion'}
			<section class="space-y-2">
				<h2 class="text-lg font-semibold text-on-surface">Cannot be converted</h2>
				<p role="alert" class="rounded-lg border border-error p-3 text-sm text-error">
					{outcome.problem}
				</p>
				<p class="text-sm text-on-surface-subtle">
					A bucket like this keeps its old filter, is listed by the migration, and has to be rebuilt by
					hand.
				</p>
			</section>
		{:else}
			<section class="space-y-2">
				<h2 class="text-lg font-semibold text-on-surface">Converted to <code>filters</code></h2>
				<p class="text-sm text-on-surface-subtle">What is saved in the new column.</p>
				<pre
					aria-label="Converted filters"
					class="max-h-72 overflow-auto rounded-lg border border-outline-subtle bg-surface-container p-3 font-mono text-xs text-on-surface">{json(outcome.converted)}</pre>
			</section>

			{#if outcome.queries.length === 0}
				<p class="text-sm text-on-surface-subtle">The bucket includes neither kind of record.</p>
			{/if}

			{#each outcome.queries as { entity, query, problem } (entity)}
				<section class="space-y-3" aria-label="{LABELS[entity]} result">
					<h2 class="text-lg font-semibold text-on-surface">{LABELS[entity]}</h2>
					<p class="text-sm text-on-surface-subtle">How the filter editor shows it.</p>
					<!-- Keyed so the editor starts again from each new conversion. -->
					{#key json(outcome.converted[entity])}
						<EntityFilterEditor {entity} group={outcome.converted[entity] ?? undefined} />
					{/key}
					{#if query}
						<SqlPreview sql={query.sql} params={query.params} label="{LABELS[entity]} SQL" />
					{:else}
						<p role="alert" class="rounded-lg border border-error p-3 text-sm text-error">{problem}</p>
					{/if}
				</section>
			{/each}
		{/if}
	</div>
</div>
