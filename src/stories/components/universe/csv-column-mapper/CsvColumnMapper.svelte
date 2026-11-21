<script lang="ts">
	import Dropdown from '$components/data-inputs/dropdown/Dropdown.svelte';
	import ArrowDownIcon from 'phosphor-svelte/lib/ArrowDown';
	import ArrowRightIcon from 'phosphor-svelte/lib/ArrowRight';
	import { mapTargets, type ColumnMapping, type MapTarget } from '$lib/shared/utils/csv-mapping';
	import {
		CONTACT_SCHEMA_FIELD_TYPE_LABELS,
		type ContactSchemaField
	} from '$lib/shared/types/contact-schemas';

	/**
	 * Matches a CSV's columns to what a contact holds. One row for each place a column can go,
	 * with a dropdown of the file's columns to fill it: the coordinates (required) and the
	 * address that every contact has, then the fields of the schema. Every place is on screen
	 * whatever the file contains, so a file with no coordinates shows plainly that they are
	 * still to be mapped.
	 */
	interface Props {
		/** The CSV's column names, in order. */
		headers: string[];
		/** A few rows from the file, to show what each column holds. */
		samples: string[][];
		/** The fields of the chosen schema. */
		fields: ContactSchemaField[];
		/** The schema's name, which heads its fields. @default 'Schema' */
		schemaName?: string;
		/**
		 * Which column fills each field: the field's id (a schema field's, or a contact data
		 * field's such as `contact.latitude`) to the column's position from 0. A field with no
		 * entry has no column. A column can fill any number of fields.
		 */
		mapping: ColumnMapping;
		onchange: (mapping: ColumnMapping) => void;
		/**
		 * What is wrong with each field, by `mapping.<field id>`, as a `Form` reports it. The
		 * first message for a field shows under its row. @default {}
		 */
		errors?: Record<string, string[]>;
	}

	const { headers, samples, fields, schemaName, mapping, onchange, errors = {} }: Props = $props();

	const targets = $derived(mapTargets(fields));

	/** The first thing wrong with a field, if anything. */
	const errorOf = (target: MapTarget) => errors[`mapping.${target.id}`]?.[0];
	/** The rows in groups: where the contact is, its address, then the schema's own fields. */
	const sections = $derived(
		[
			{
				id: 'location',
				title: 'Location',
				targets: targets.filter((t) => t.contactData && t.required)
			},
			{
				id: 'address',
				title: 'Address',
				targets: targets.filter((t) => t.contactData && !t.required)
			},
			{
				id: 'schema',
				title: `${schemaName ?? 'Schema'} fields`,
				targets: targets.filter((t) => !t.contactData)
			}
		].filter((section) => section.targets.length > 0)
	);

	/** The value of a row's dropdown for no column. */
	const NONE = '';

	/** The columns a row can pick: none, or any of the file's. A column can be used by any number of rows. */
	const columnItems = $derived([
		{ value: NONE, label: 'Not mapped' },
		...headers.map((header, column) => ({ value: String(column), label: header }))
	]);

	/** Gives a field a column, or none with an empty value. Other fields keep theirs, even the same column. */
	function choose(target: MapTarget, value: string) {
		const next = { ...mapping };
		if (value === NONE) delete next[target.id];
		else next[target.id] = Number(value);
		onchange(next);
	}

	/** What a column holds, from the rows read from the file. */
	function sampleText(column: number): string {
		return samples
			.map((row) => row[column])
			.filter((cell) => cell !== undefined && cell !== '')
			.join(', ');
	}
</script>

<div class="@container flex flex-col gap-5">
	{#each sections as section (section.id)}
		<section aria-labelledby="mapper-{section.id}" class="flex flex-col gap-2">
			<h3 id="mapper-{section.id}" class="text-sm font-semibold text-on-surface">
				{section.title}
			</h3>
			<div class="overflow-hidden rounded-lg border border-outline">
				<!-- Names the two sides of every row below: the file's column, then the contact's field.
			     It has the rows' own columns, so the words sit over what they name. -->
				<div
					class="grid grid-cols-1 gap-x-4 border-b border-outline-subtle bg-surface-container px-4 py-2 text-xs font-medium text-on-surface-subtle select-none @xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"
				>
					<span>CSV</span>
					<span class="hidden w-4 @xl:block" aria-hidden="true"></span>
					<span>CONTACT</span>
				</div>
				<ul class="flex flex-col divide-y divide-outline-subtle">
					{#each section.targets as target (target.id)}
						{@const column = mapping[target.id]}
						{@const error = errorOf(target)}
						<!-- The file's column on the left, an arrow, and the field it fills on the right. Wide
					     enough, they sit side by side; narrower, they stack with the arrow pointing down. -->
						<li
							class="grid grid-cols-1 items-center gap-x-4 gap-y-2 px-4 py-3 @xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"
						>
							<div class="min-w-0">
								<Dropdown
									class="w-full max-w-72"
									aria-label="Column for {target.name}"
									aria-invalid={error ? true : undefined}
									placeholder="Not mapped"
									items={columnItems}
									value={column === undefined ? NONE : String(column)}
									onValueChange={(next) => choose(target, next)}
								/>
								{#if column !== undefined}
									<p class="mt-1 truncate text-xs text-on-surface-subtle">
										{sampleText(column) || 'No values'}
									</p>
								{/if}
							</div>
							<ArrowRightIcon
								size={16}
								class="hidden shrink-0 text-on-surface-subtle @xl:block"
								aria-hidden="true"
							/>
							<ArrowDownIcon
								size={16}
								class="shrink-0 text-on-surface-subtle @xl:hidden"
								aria-hidden="true"
							/>
							<div class="min-w-0">
								<p class="text-sm font-medium text-on-surface">
									{target.name}{#if target.required}<span class="text-error" aria-hidden="true">
											*</span
										>{/if}
								</p>
								<p class="text-xs text-on-surface-subtle">
									{CONTACT_SCHEMA_FIELD_TYPE_LABELS[target.type]}{target.required
										? ', required'
										: ''}
								</p>
							</div>
							{#if error}
								<p
									role="alert"
									class="rounded-md bg-error-container px-3 py-2 text-sm text-on-error-container @xl:col-span-3"
								>
									{error}
								</p>
							{/if}
						</li>
					{/each}
				</ul>
			</div>
		</section>
	{/each}
</div>
