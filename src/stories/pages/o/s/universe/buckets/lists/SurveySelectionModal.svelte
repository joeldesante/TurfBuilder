<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { goto } from '$app/navigation';
	import { CalendarDate, today, getLocalTimeZone } from '@internationalized/date';
	import type { DateValue } from '@internationalized/date';
	import Button from '$components/actions/button/Button.svelte';
	import Select from '$components/data-inputs/select/Select.svelte';
	import DatePicker from '$components/data-inputs/date-picker/DatePicker.svelte';
	import XIcon from 'phosphor-svelte/lib/X';
	import SpinnerGap from 'phosphor-svelte/lib/SpinnerGap';

	interface Props {
		open: boolean;
		orgSlug: string;
		bucketSlug: string;
		listId: string;
		listName: string;
		onClose: () => void;
	}

	const { open, orgSlug, bucketSlug, listId, listName, onClose }: Props = $props();

	let surveys: { id: string; name: string }[] = $state([]);
	let scripts: { id: string; name: string }[] = $state([]);
	let selectedSurveyId = $state('');
	let selectedScriptId = $state('');
	let loading = $state(false);
	let error = $state<string | null>(null);

	const defaultExpiration = today(getLocalTimeZone()).add({ days: 7 });
	let expiresAt = $state<DateValue>(defaultExpiration);

	async function loadData() {
		loading = true;
		error = null;
		try {
			const [surveysRes, scriptsRes] = await Promise.all([
				fetch(`/o/${orgSlug}/s/api/surveys?bucketSlug=${encodeURIComponent(bucketSlug)}`),
				fetch(`/o/${orgSlug}/s/api/scripts?bucket=${encodeURIComponent(bucketSlug)}`)
			]);

			if (!surveysRes.ok) {
				const body = await surveysRes.json().catch(() => ({}));
				error = body.error ?? `Failed to load surveys (${surveysRes.status})`;
				return;
			}
			surveys = await surveysRes.json();
			if (surveys.length === 0) {
				error = 'No surveys available. Create a survey first before cutting turfs.';
				return;
			}

			if (scriptsRes.ok) {
				scripts = await scriptsRes.json();
			}
		} catch {
			error = 'Failed to load data.';
		} finally {
			loading = false;
		}
	}

	async function handleProceed() {
		if (!selectedSurveyId) return;

		sessionStorage.setItem(
			'universe_cut_survey_selection',
			JSON.stringify({
				surveyId: selectedSurveyId,
				scriptId: selectedScriptId || null,
				expiresAt: expiresAt.toString()
			})
		);

		await goto(`/o/${orgSlug}/s/universe/buckets/${bucketSlug}/lists/${listId}/cut`);
	}

	$effect(() => {
		if (open) {
			loadData();
			selectedSurveyId = '';
			selectedScriptId = '';
			expiresAt = defaultExpiration;
		}
	});

	const surveyItems = $derived(surveys.map((s) => ({ value: s.id, label: s.name })));
	const scriptItems = $derived([
		{ value: '', label: 'No script' },
		...scripts.map((s) => ({ value: s.id, label: s.name }))
	]);
</script>

<Dialog.Root {open} onOpenChange={(v) => { if (!v) onClose(); }}>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-50 bg-black/50" />
		<Dialog.Content
			class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md p-6 rounded-xl bg-surface border border-outline-subtle shadow-xl"
			aria-label="Select survey for cutting turfs"
		>
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-lg font-semibold text-on-surface">Cut Turfs</h2>
				<button
					onclick={onClose}
					class="rounded-md p-1.5 text-on-surface-subtle hover:bg-surface-container hover:text-on-surface transition-colors"
					aria-label="Close"
				>
					<XIcon class="size-4" />
				</button>
			</div>

			{#if loading}
				<div class="flex items-center justify-center py-8 text-on-surface-subtle">
					<SpinnerGap class="size-5 animate-spin mr-2" />
					<span>Loading...</span>
				</div>
			{:else if error}
				<div class="rounded-lg bg-error/10 border border-error/30 p-3 mb-4 text-sm text-error">
					{error}
				</div>
			{:else}
				<div class="space-y-4">
					<p class="text-sm text-on-surface-subtle">
						Configure the turfs you're about to cut from <span class="font-medium">{listName}</span>.
					</p>

					<div class="space-y-2">
						<label for="survey-select" class="block text-sm font-medium text-on-surface">Survey</label>
						<Select
							id="survey-select"
							bind:value={selectedSurveyId}
							items={surveyItems}
							placeholder="Select a survey..."
						/>
					</div>

					<div class="space-y-2">
						<label for="script-select" class="block text-sm font-medium text-on-surface">Script <span class="font-normal text-on-surface-subtle">(optional)</span></label>
						<Select
							id="script-select"
							bind:value={selectedScriptId}
							items={scriptItems}
							placeholder="No script"
						/>
					</div>

					<div class="space-y-2">
						<label class="block text-sm font-medium text-on-surface">Expiration Date</label>
						<DatePicker bind:value={expiresAt} minValue={today(getLocalTimeZone())} />
					</div>

					<div class="flex gap-2 pt-4">
						<Button variant="outline" onclick={onClose} class="flex-1">Cancel</Button>
						<Button
							onclick={handleProceed}
							disabled={!selectedSurveyId}
							class="flex-1"
						>
							Proceed to Map
						</Button>
					</div>
				</div>
			{/if}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
