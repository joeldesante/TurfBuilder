<script lang="ts">
	import PageHeader from '$components/layout/page-header/PageHeader.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import UploadIcon from 'phosphor-svelte/lib/Upload';
	import DownloadIcon from 'phosphor-svelte/lib/Download';
	import CheckCircleIcon from 'phosphor-svelte/lib/CheckCircle';
	import WarningCircleIcon from 'phosphor-svelte/lib/WarningCircle';

	interface ImportResult {
		imported: number;
		skipped: number;
		errors: { row: number; reason: string }[];
	}

	interface Props {
		count: number;
		org_slug: string;
	}

	const { count, org_slug }: Props = $props();

	let fileInput: HTMLInputElement;
	let selectedFile = $state<File | null>(null);
	let uploading = $state(false);
	let result = $state<ImportResult | null>(null);
	let uploadError = $state<string | null>(null);
	let errorsExpanded = $state(false);

	const CSV_TEMPLATE = 'location_name,street,locality,postcode,region,country,latitude,longitude,category,confidence\n';

	function handleFileChange(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		selectedFile = input.files?.[0] ?? null;
		result = null;
		uploadError = null;
	}

	function downloadTemplate() {
		const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'location-import-template.csv';
		a.click();
		URL.revokeObjectURL(url);
	}

	async function handleUpload() {
		if (!selectedFile) return;
		uploading = true;
		result = null;
		uploadError = null;

		try {
			const form = new FormData();
			form.append('file', selectedFile);
			const res = await fetch(`/o/${org_slug}/s/api/locations/import`, {
				method: 'POST',
				body: form
			});

			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				uploadError = body.error ?? `Upload failed (${res.status})`;
				return;
			}

			result = await res.json();
			errorsExpanded = false;
			selectedFile = null;
			if (fileInput) fileInput.value = '';
		} catch {
			uploadError = 'Network error. Please try again.';
		} finally {
			uploading = false;
		}
	}
</script>

<PageHeader title="Import Locations" subheading="Upload CSV or GeoJSON files to add private location data to your organization's dataset." />

<div class="p-6 space-y-6 max-w-2xl">
	<div class="rounded-lg border border-outline p-4 bg-surface-container/40">
		<p class="text-sm text-on-surface">
			Your organization has <span class="font-semibold text-on-surface">{count.toLocaleString()}</span> private location{count === 1 ? '' : 's'} in its dataset.
		</p>
	</div>

	<div class="space-y-4">
		<div class="flex items-center gap-2">
			<h2 class="text-sm font-semibold text-on-surface">Upload File</h2>
			<button
				class="flex items-center gap-1 text-xs text-primary hover:underline focus:outline-none"
				onclick={downloadTemplate}
				aria-label="Download CSV template"
			>
				<DownloadIcon size={13} />
				Download CSV template
			</button>
		</div>

		<div class="rounded-lg border-2 border-dashed border-outline-subtle hover:border-outline transition-colors p-8 text-center">
			<UploadIcon size={28} class="mx-auto mb-2 text-on-surface-subtle" />
			<p class="text-sm text-on-surface-subtle mb-3">
				{#if selectedFile}
					<span class="font-medium text-on-surface">{selectedFile.name}</span>
					<span class="text-on-surface-subtle"> ({(selectedFile.size / 1024).toFixed(1)} KB)</span>
				{:else}
					Choose a <strong>.csv</strong>, <strong>.geojson</strong>, or <strong>.json</strong> file
				{/if}
			</p>
			<input
				bind:this={fileInput}
				type="file"
				accept=".csv,.json,.geojson"
				class="sr-only"
				id="location-file-input"
				onchange={handleFileChange}
			/>
			<label
				for="location-file-input"
				class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-outline text-sm text-on-surface bg-surface hover:bg-surface-container cursor-pointer transition-colors"
			>
				Browse files
			</label>
		</div>

		<div class="flex justify-end">
			<Button
				onclick={handleUpload}
				disabled={!selectedFile || uploading}
			>
				{uploading ? 'Importing…' : 'Import Locations'}
			</Button>
		</div>
	</div>

	{#if uploadError}
		<div class="flex items-start gap-2 rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
			<WarningCircleIcon size={16} class="mt-0.5 shrink-0" />
			<p>{uploadError}</p>
		</div>
	{/if}

	{#if result}
		<div class="rounded-lg border border-outline overflow-hidden">
			<div class="flex items-center gap-2 px-4 py-3 bg-surface-container border-b border-outline-subtle">
				<CheckCircleIcon size={16} class="text-success shrink-0" />
				<p class="text-sm font-medium text-on-surface">
					Imported {result.imported.toLocaleString()} location{result.imported === 1 ? '' : 's'}
					{#if result.skipped > 0}
						· {result.skipped} skipped
					{/if}
				</p>
			</div>

			{#if result.errors.length > 0}
				<div class="px-4 py-3">
					<button
						class="text-xs text-on-surface-subtle hover:text-on-surface underline focus:outline-none"
						onclick={() => (errorsExpanded = !errorsExpanded)}
					>
						{errorsExpanded ? 'Hide' : 'Show'} {result.errors.length} row error{result.errors.length === 1 ? '' : 's'}
					</button>

					{#if errorsExpanded}
						<ul class="mt-2 space-y-1 max-h-48 overflow-y-auto">
							{#each result.errors as err (err.row)}
								<li class="text-xs text-on-surface-subtle">
									<span class="font-medium text-on-surface">Row {err.row}:</span> {err.reason}
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>
