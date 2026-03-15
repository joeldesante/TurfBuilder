<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { CalendarDate, today, getLocalTimeZone } from '@internationalized/date';
	import type { DateValue } from '@internationalized/date';
	import PageHeader from '$components/layout/page-header/PageHeader.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import Select from '$components/data-inputs/select/Select.svelte';
	import DatePicker from '$components/data-inputs/date-picker/DatePicker.svelte';

	let { data } = $props();

	const orgSlug = $page.params.org_slug;

	let polygons: unknown[] = $state([]);
	let selectedSurveyId = $state('');
	let saving = $state(false);

	const defaultExpiration = today(getLocalTimeZone()).add({ days: 7 });
	let expiresAt = $state<DateValue>(defaultExpiration);

	onMount(() => {
		const stored = sessionStorage.getItem('pending_turfs');
		if (!stored) {
			goto(`/o/${orgSlug}/s/turfs/cut`);
			return;
		}
		polygons = JSON.parse(stored);
	});

	const surveyItems = $derived(
		data.surveys.map((s: { id: string; name: string }) => ({ value: s.id, label: s.name }))
	);

	async function save() {
		if (saving || !selectedSurveyId) return;
		saving = true;

		const response = await fetch(`/o/${orgSlug}/s/api/turf/create`, {
			method: 'POST',
			body: JSON.stringify({
				polygons,
				survey_id: selectedSurveyId,
				expires_at: expiresAt.toString()
			})
		});

		saving = false;

		if (response.ok) {
			sessionStorage.removeItem('pending_turfs');
			await goto(`/o/${orgSlug}/s/turfs`);
		}
	}
</script>

<PageHeader
	title="Set Survey"
	subheading="Choose a survey to associate with the {polygons.length} new turf{polygons.length === 1 ? '' : 's'}."
	breadcrumbs={[
		{ label: 'Turfs', href: `/o/${orgSlug}/s/turfs` },
		{ label: 'Cut Turfs', href: `/o/${orgSlug}/s/turfs/cut` },
		{ label: 'Set Survey' }
	]}
>
	{#snippet actions()}
		<Button variant="outline" href="/o/{orgSlug}/s/turfs/cut">← Back</Button>
		<Button onclick={save} loading={saving} disabled={polygons.length === 0 || !selectedSurveyId}>
			Save Turfs
		</Button>
	{/snippet}
</PageHeader>

<div class="max-w-md space-y-6">
	<div class="space-y-2">
		<label for="survey-select" class="block text-sm text-on-surface-subtle">Survey</label>
		<Select
			id="survey-select"
			bind:value={selectedSurveyId}
			items={surveyItems}
			placeholder="Select a survey..."
		/>
	</div>

	<div class="space-y-2">
		<label class="block text-sm text-on-surface-subtle">Expiration Date</label>
		<DatePicker bind:value={expiresAt} minValue={today(getLocalTimeZone())} />
	</div>
</div>
