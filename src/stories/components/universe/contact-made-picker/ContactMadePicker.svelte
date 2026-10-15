<script lang="ts">
	import { parseDate } from '@internationalized/date';
	import type { DateValue } from '@internationalized/date';
	import Button from '$components/actions/button/Button.svelte';
	import DatePicker from '$components/data-inputs/date-picker/DatePicker.svelte';
	import Dropdown from '$components/data-inputs/dropdown/Dropdown.svelte';
	import TextInput from '$components/data-inputs/text-input/TextInput.svelte';
	import type { FilterSource, SourceBucket, SourceList } from '$lib/client/filter-source';
	import type { ContactMadeValue } from '$lib/shared/types/filters';

	interface Props {
		/** Where the buckets and lists to choose from come from. Without one, the attempts cannot be limited to a bucket or list. */
		source?: FilterSource;
		value: ContactMadeValue;
		onchange: (value: ContactMadeValue) => void;
	}

	const { source, value, onchange }: Props = $props();

	/** Stands for "no bucket" / "no list" in a dropdown, which cannot select an empty value. */
	const ANY = 'any';

	let buckets = $state<SourceBucket[]>([]);
	let lists = $state<SourceList[]>([]);
	let failed = $state(false);

	/** Loads a list, ignoring the answer once the inputs it was asked for have changed. */
	function load<T>(fetcher: (() => Promise<T[]>) | null, set: (rows: T[]) => void): () => void {
		let stale = false;
		if (!fetcher) {
			set([]);
			return () => {};
		}
		fetcher().then(
			(rows) => {
				if (stale) return;
				failed = false;
				set(rows);
			},
			() => {
				if (stale) return;
				failed = true;
				set([]);
			}
		);
		return () => {
			stale = true;
		};
	}

	$effect(() => load(source ? () => source.listBuckets() : null, (rows) => (buckets = rows)));
	$effect(() => {
		const id = value.bucketId;
		return load(source && id ? () => source.listLists(id) : null, (rows) => (lists = rows));
	});

	function change(next: Partial<ContactMadeValue>) {
		onchange({ ...value, ...next });
	}

	function setPosition(position: ContactMadeValue['position']) {
		change({ position, n: position === 'nth_from_last' ? (value.n ?? 2) : null });
	}

	function toDate(text: string | null): DateValue | undefined {
		if (!text) return undefined;
		try {
			return parseDate(text);
		} catch {
			return undefined;
		}
	}
</script>

<div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
	<Dropdown
		class="min-w-0"
		aria-label="Outcome"
		items={[
			{ value: 'yes', label: 'Contact was made' },
			{ value: 'no', label: 'No contact was made' }
		]}
		value={value.contacted ? 'yes' : 'no'}
		onValueChange={(next) => change({ contacted: next === 'yes' })}
	/>

	<span class="text-sm text-on-surface-subtle">on</span>

	<Dropdown
		class="min-w-0"
		aria-label="Attempt"
		items={[
			{ value: 'any', label: 'any attempt' },
			{ value: 'latest', label: 'the latest attempt' },
			{ value: 'nth_from_last', label: 'an earlier attempt' }
		]}
		value={value.position}
		onValueChange={(next) => setPosition(next as ContactMadeValue['position'])}
	/>

	{#if value.position === 'nth_from_last'}
		<TextInput
			type="number"
			min="2"
			max="50"
			class="w-20"
			aria-label="Attempts back"
			value={String(value.n ?? '')}
			oninput={(e: Event) => {
				const raw = (e.currentTarget as HTMLInputElement).value;
				change({ n: raw === '' ? null : Number(raw) });
			}}
		/>
		<span class="text-sm text-on-surface-subtle">from the last (2 is the one before the latest)</span>
	{/if}

	{#if source}
		<span class="text-sm text-on-surface-subtle">in</span>
		<Dropdown
			class="min-w-0 max-w-56"
			aria-label="Bucket"
			items={[
				{ value: ANY, label: 'any bucket' },
				...buckets.map((b) => ({ value: b.id, label: b.name }))
			]}
			value={value.bucketId ?? ANY}
			onValueChange={(next) =>
				change({ bucketId: next === ANY ? null : next, listId: null })}
		/>

		{#if value.bucketId}
			<Dropdown
				class="min-w-0 max-w-56"
				aria-label="List"
				items={[
					{ value: ANY, label: 'any list' },
					...lists.map((l) => ({ value: l.id, label: l.name }))
				]}
				value={value.listId ?? ANY}
				onValueChange={(next) => change({ listId: next === ANY ? null : next })}
			/>
		{/if}
	{/if}

	<span class="text-sm text-on-surface-subtle">between</span>
	<DatePicker
		aria-label="From"
		value={toDate(value.from)}
		maxValue={toDate(value.to)}
		onValueChange={(next: DateValue | undefined) => change({ from: next?.toString() ?? null })}
	/>
	<span class="text-sm text-on-surface-subtle">and</span>
	<DatePicker
		aria-label="To"
		value={toDate(value.to)}
		minValue={toDate(value.from)}
		onValueChange={(next: DateValue | undefined) => change({ to: next?.toString() ?? null })}
	/>
	{#if value.from || value.to}
		<Button variant="ghost" size="sm" onclick={() => change({ from: null, to: null })}>
			Clear dates
		</Button>
	{/if}

	{#if failed}
		<span class="text-sm text-error">The bucket and list choices could not be loaded.</span>
	{/if}
</div>
