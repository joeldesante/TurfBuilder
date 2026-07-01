<script lang="ts">
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import UploadSimpleIcon from 'phosphor-svelte/lib/UploadSimple';
	import LinkIcon from 'phosphor-svelte/lib/Link';
	import CheckCircleIcon from 'phosphor-svelte/lib/CheckCircle';
	import WarningCircleIcon from 'phosphor-svelte/lib/WarningCircle';
	export type ImportSource = 'csv' | 'google-sheets';

	export interface ImportResult {
		imported: number;
		skipped: number;
		errors: { row: number; reason: string }[];
	}

	interface Props {
		orgSlug: string;
		source: ImportSource;
		onImportCsv?: (file: File) => Promise<ImportResult>;
		onImportGoogleSheets?: (url: string) => Promise<ImportResult>;
	}

	const { orgSlug, source, onImportCsv, onImportGoogleSheets }: Props = $props();

	const sourceLabels: Record<ImportSource, string> = {
		csv: 'CSV or Excel',
		'google-sheets': 'Google Sheets'
	};

	let fileInput = $state<HTMLInputElement | null>(null);
	let sheetsUrl = $state('');
	let importing = $state(false);
	let result = $state<ImportResult | null>(null);
	let error = $state<string | null>(null);

	async function handleCsvFile(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file || !onImportCsv) return;
		importing = true;
		result = null;
		error = null;
		try {
			result = await onImportCsv(file);
		} catch (err) {
			error = err instanceof Error ? err.message : 'An unexpected error occurred.';
		} finally {
			importing = false;
			input.value = '';
		}
	}

	async function handleGoogleSheets() {
		if (!sheetsUrl.trim() || !onImportGoogleSheets) return;
		importing = true;
		result = null;
		error = null;
		try {
			result = await onImportGoogleSheets(sheetsUrl.trim());
		} catch (err) {
			error = err instanceof Error ? err.message : 'An unexpected error occurred.';
		} finally {
			importing = false;
		}
	}


</script>

<PageHeader
	title="Import from {sourceLabels[source]}"
	subheading="Add location records to your organization's universe."
	breadcrumbs={[
		{ label: 'Locations', href: `/o/${orgSlug}/s/universe/data/locations` },
		{ label: sourceLabels[source] }
	]}
/>

<div class="max-w-xl space-y-6">
	{#if result}
		<div
			class="rounded-lg border border-outline bg-surface-container-low p-4 flex items-start gap-3 text-sm"
			role="status"
			aria-live="polite"
		>
			<CheckCircleIcon class="size-5 text-green-600 mt-0.5 shrink-0" />
			<div>
				<p class="font-medium text-on-surface">
					{result.imported.toLocaleString()} imported{#if result.skipped > 0}, {result.skipped.toLocaleString()} skipped{/if}
				</p>
				{#if result.errors.length > 0}
					<ul class="mt-1 space-y-0.5 text-on-surface-subtle">
						{#each result.errors.slice(0, 5) as err}
							<li>Row {err.row}: {err.reason}</li>
						{/each}
						{#if result.errors.length > 5}
							<li>...and {result.errors.length - 5} more row errors</li>
						{/if}
					</ul>
				{/if}
			</div>
		</div>
	{/if}

	{#if error}
		<div
			class="rounded-lg border border-error/30 bg-error/5 p-4 flex items-start gap-3 text-sm"
			role="alert"
		>
			<WarningCircleIcon class="size-5 text-error mt-0.5 shrink-0" />
			<p class="text-error">{error}</p>
		</div>
	{/if}

	{#if source === 'csv'}
		<div class="rounded-xl border border-outline bg-surface-container p-6 space-y-4">
			<div class="flex items-center gap-3">
				<div class="flex items-center justify-center rounded-lg bg-primary/10 p-2.5">
					<UploadSimpleIcon class="size-5 text-primary" />
				</div>
				<div>
					<h2 class="text-base font-medium text-on-surface">Upload file</h2>
					<p class="text-sm text-on-surface-subtle">Accepts .csv and .xlsx files</p>
				</div>
			</div>
			<p class="text-sm text-on-surface-subtle">
				Supported columns:
				{#each ['name', 'address_line_1', 'address_line_2', 'city', 'state_or_region', 'postal_code', 'country_code', 'latitude', 'longitude'] as col}
					<code class="text-xs bg-surface-container-high rounded px-1 py-0.5">{col}</code>{' '}
				{/each}
				Include <code class="text-xs bg-surface-container-high rounded px-1 py-0.5">latitude</code>
				and
				<code class="text-xs bg-surface-container-high rounded px-1 py-0.5">longitude</code> to enable
				turf cutting.
			</p>
			<input
				bind:this={fileInput}
				type="file"
				accept=".csv,.xlsx"
				class="sr-only"
				aria-label="Select CSV or Excel file"
				onchange={handleCsvFile}
			/>
			<Button
				variant="outline"
				disabled={!onImportCsv}
				loading={importing}
				onclick={() => fileInput?.click()}
			>
				<UploadSimpleIcon />
				Choose file
			</Button>
		</div>
	{:else if source === 'google-sheets'}
		<div class="rounded-xl border border-outline bg-surface-container p-6 space-y-4">
			<div class="flex items-center gap-3">
				<div class="flex items-center justify-center rounded-lg bg-primary/10 p-2.5">
					<LinkIcon class="size-5 text-primary" />
				</div>
				<div>
					<h2 class="text-base font-medium text-on-surface">Sheet URL</h2>
					<p class="text-sm text-on-surface-subtle">Paste a link to a published Google Sheet</p>
				</div>
			</div>
			<p class="text-sm text-on-surface-subtle">
				The sheet must be published to the web. Column headers should match the supported columns:
				{#each ['name', 'address_line_1', 'city', 'state_or_region', 'postal_code', 'country_code', 'latitude', 'longitude'] as col}
					<code class="text-xs bg-surface-container-high rounded px-1 py-0.5">{col}</code>{' '}
				{/each}
			</p>
			<div class="flex gap-2">
				<input
					type="url"
					bind:value={sheetsUrl}
					placeholder="https://docs.google.com/spreadsheets/d/..."
					class="flex-1 h-10 rounded-lg border border-outline bg-surface px-3 text-sm text-on-surface placeholder:text-on-surface-subtle focus:outline-2 focus:outline-primary focus:outline-offset-1"
					aria-label="Google Sheets URL"
				/>
				<Button
					variant="outline"
					disabled={!sheetsUrl.trim() || !onImportGoogleSheets}
					loading={importing}
					onclick={handleGoogleSheets}
				>
					Import
				</Button>
			</div>
		</div>
	{/if}
</div>
