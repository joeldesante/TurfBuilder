<script lang="ts">
	import type { DateValue } from '@internationalized/date';
	import Select from '$components/data-inputs/select/Select.svelte';
	import DatePicker from '$components/data-inputs/date-picker/DatePicker.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import SpinnerGap from 'phosphor-svelte/lib/SpinnerGap';

	export interface MetricsBucket {
		id: string;
		name: string;
		slug: string;
	}

	export interface MetricsWorkflowSelection {
		bucketId: string;
		surveyId: string;
		startDate: string | null;
		endDate: string | null;
	}

	interface Props {
		orgSlug: string;
		buckets: MetricsBucket[];
		onGenerate: (selection: MetricsWorkflowSelection) => void;
	}

	const { orgSlug, buckets, onGenerate }: Props = $props();

	let selectedBucketId = $state('');
	let selectedSurveyId = $state('');
	let surveys = $state<{ id: string; name: string }[]>([]);
	let loadingSurveys = $state(false);
	let surveyError = $state<string | null>(null);
	let startDate = $state<DateValue | undefined>(undefined);
	let endDate = $state<DateValue | undefined>(undefined);

	async function loadSurveys(bucketId: string) {
		loadingSurveys = true;
		surveyError = null;
		surveys = [];
		selectedSurveyId = '';
		try {
			const res = await fetch(
				`/o/${orgSlug}/s/api/surveys?bucketId=${encodeURIComponent(bucketId)}`
			);
			if (!res.ok) {
				surveyError = 'Failed to load surveys.';
				return;
			}
			surveys = await res.json();
		} catch {
			surveyError = 'Failed to load surveys.';
		} finally {
			loadingSurveys = false;
		}
	}

	$effect(() => {
		if (selectedBucketId) {
			loadSurveys(selectedBucketId);
		} else {
			surveys = [];
			selectedSurveyId = '';
		}
	});

	const bucketItems = $derived(buckets.map((b) => ({ value: b.id, label: b.name })));
	const surveyItems = $derived(surveys.map((s) => ({ value: s.id, label: s.name })));
	const canGenerate = $derived(Boolean(selectedBucketId && selectedSurveyId));

	function toDateString(value: DateValue | undefined): string | null {
		return value ? value.toString() : null;
	}

	function handleGenerate() {
		onGenerate({
			bucketId: selectedBucketId,
			surveyId: selectedSurveyId,
			startDate: toDateString(startDate),
			endDate: toDateString(endDate)
		});
	}
</script>

<aside class="w-72 shrink-0 border-l border-outline-subtle p-4 space-y-4">
	<div class="space-y-2">
		<label for="metrics-bucket-select" class="block text-sm font-medium text-on-surface"
			>Bucket</label
		>
		<Select
			id="metrics-bucket-select"
			bind:value={selectedBucketId}
			items={bucketItems}
			placeholder="Select a bucket..."
		/>
	</div>

	{#if selectedBucketId}
		<div class="space-y-2">
			<label for="metrics-survey-select" class="block text-sm font-medium text-on-surface"
				>Survey</label
			>
			{#if loadingSurveys}
				<div class="flex items-center gap-2 text-sm text-on-surface-subtle">
					<SpinnerGap class="size-4 animate-spin" aria-hidden="true" />
					<span>Loading surveys...</span>
				</div>
			{:else if surveyError}
				<p class="text-sm text-error">{surveyError}</p>
			{:else}
				<Select
					id="metrics-survey-select"
					bind:value={selectedSurveyId}
					items={surveyItems}
					placeholder="Select a survey..."
					disabled={surveyItems.length === 0}
				/>
				{#if surveyItems.length === 0}
					<p class="text-xs text-on-surface-subtle">No surveys in this bucket.</p>
				{/if}
			{/if}
		</div>
	{/if}

	{#if selectedSurveyId}
		<div class="space-y-2">
			<span class="block text-sm font-medium text-on-surface">
				Date range <span class="font-normal text-on-surface-subtle">(optional)</span>
			</span>
			<div class="space-y-2">
				<div class="space-y-1">
					<label for="metrics-start-date" class="block text-xs text-on-surface-subtle">From</label>
					<DatePicker
						id="metrics-start-date"
						bind:value={startDate}
						placeholder={undefined}
						maxValue={endDate}
					/>
				</div>
				<div class="space-y-1">
					<label for="metrics-end-date" class="block text-xs text-on-surface-subtle">To</label>
					<DatePicker
						id="metrics-end-date"
						bind:value={endDate}
						placeholder={undefined}
						minValue={startDate}
					/>
				</div>
			</div>
			<p class="text-xs text-on-surface-subtle">Leave blank to include responses from all time.</p>
		</div>

		<Button onclick={handleGenerate} disabled={!canGenerate} class="w-full">View Results</Button>
	{/if}
</aside>
