<script lang="ts">
	import PageHeader from '$components/layout/fragments/page-header/PageHeader.svelte';
	import Button from '$components/actions/button/Button.svelte';
	import { UsersIcon, MapPinIcon, UploadSimpleIcon, CheckCircleIcon, WarningCircleIcon } from 'phosphor-svelte';

	export interface ImportResult {
		imported: number;
		skipped: number;
		errors: { row: number; reason: string }[];
	}

	interface Props {
		/** Current count of people records in the org universe. */
		peopleCount?: number;
		/** Current count of location records in the org universe. */
		locationsCount?: number;
		/** Called when the user selects a CSV file to import people. */
		onImportPeople?: (file: File) => Promise<ImportResult>;
		/** Called when the user selects a CSV file to import locations. */
		onImportLocations?: (file: File) => Promise<ImportResult>;
	}

	const {
		peopleCount = 0,
		locationsCount = 0,
		onImportPeople,
		onImportLocations
	}: Props = $props();

	// People import state
	let peopleFileInput = $state<HTMLInputElement | null>(null);
	let peopleImporting = $state(false);
	let peopleResult = $state<ImportResult | null>(null);
	let peopleError = $state<string | null>(null);
	let peopleAdded = $state(0);

	// Locations import state
	let locationsFileInput = $state<HTMLInputElement | null>(null);
	let locationsImporting = $state(false);
	let locationsResult = $state<ImportResult | null>(null);
	let locationsError = $state<string | null>(null);
	let locationsAdded = $state(0);

	let displayPeopleCount = $derived(peopleCount + peopleAdded);
	let displayLocationsCount = $derived(locationsCount + locationsAdded);

	async function handlePeopleFile(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file || !onImportPeople) return;

		peopleImporting = true;
		peopleResult = null;
		peopleError = null;

		try {
			const result = await onImportPeople(file);
			peopleResult = result;
			peopleAdded += result.imported;
		} catch (err) {
			peopleError = err instanceof Error ? err.message : 'An unexpected error occurred.';
		} finally {
			peopleImporting = false;
			input.value = '';
		}
	}

	async function handleLocationsFile(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file || !onImportLocations) return;

		locationsImporting = true;
		locationsResult = null;
		locationsError = null;

		try {
			const result = await onImportLocations(file);
			locationsResult = result;
			locationsAdded += result.imported;
		} catch (err) {
			locationsError = err instanceof Error ? err.message : 'An unexpected error occurred.';
		} finally {
			locationsImporting = false;
			input.value = '';
		}
	}

	function formatCount(n: number, singular: string, plural: string): string {
		return `${n.toLocaleString()} ${n === 1 ? singular : plural}`;
	}
</script>

<div>
	<PageHeader
		title="Universe Data Manager"
		subheading="Import and manage your organization's people and location datasets."
	/>

	<div class="grid gap-6 md:grid-cols-2">
		<!-- People dataset card -->
		<div class="rounded-xl border border-outline bg-surface-container p-6 flex flex-col gap-4">
			<div class="flex items-center gap-3">
				<div class="flex items-center justify-center rounded-lg bg-primary/10 p-2.5">
					<UsersIcon class="size-5 text-primary" />
				</div>
				<div>
					<h2 class="text-base font-medium text-on-surface">People</h2>
					<p class="text-sm text-on-surface-subtle">
						{formatCount(displayPeopleCount, 'record', 'records')}
					</p>
				</div>
			</div>

			<p class="text-sm text-on-surface-subtle">
				Import individuals from a CSV file. Supported columns:
				<code class="text-xs bg-surface-container-high rounded px-1 py-0.5">first_name</code>,
				<code class="text-xs bg-surface-container-high rounded px-1 py-0.5">last_name</code>,
				<code class="text-xs bg-surface-container-high rounded px-1 py-0.5">email</code>,
				<code class="text-xs bg-surface-container-high rounded px-1 py-0.5">phone</code>,
				<code class="text-xs bg-surface-container-high rounded px-1 py-0.5">dob</code>
				(YYYY-MM-DD),
				<code class="text-xs bg-surface-container-high rounded px-1 py-0.5">middle_name</code>,
				<code class="text-xs bg-surface-container-high rounded px-1 py-0.5">suffix</code>,
				<code class="text-xs bg-surface-container-high rounded px-1 py-0.5">preferred_name</code>,
				<code class="text-xs bg-surface-container-high rounded px-1 py-0.5">gender</code>.
			</p>

			{#if peopleResult}
				<div
					class="rounded-lg border border-outline bg-surface-container-low p-3 text-sm flex items-start gap-2"
					role="status"
					aria-live="polite"
				>
					<CheckCircleIcon class="size-4 text-green-600 mt-0.5 shrink-0" />
					<div>
						<p class="font-medium text-on-surface">
							{peopleResult.imported.toLocaleString()} imported
							{#if peopleResult.skipped > 0}
								, {peopleResult.skipped.toLocaleString()} skipped
							{/if}
						</p>
						{#if peopleResult.errors.length > 0}
							<ul class="mt-1 space-y-0.5 text-on-surface-subtle">
								{#each peopleResult.errors.slice(0, 5) as err}
									<li>Row {err.row}: {err.reason}</li>
								{/each}
								{#if peopleResult.errors.length > 5}
									<li>...and {peopleResult.errors.length - 5} more row errors</li>
								{/if}
							</ul>
						{/if}
					</div>
				</div>
			{/if}

			{#if peopleError}
				<div
					class="rounded-lg border border-error/30 bg-error/5 p-3 text-sm flex items-start gap-2"
					role="alert"
				>
					<WarningCircleIcon class="size-4 text-error mt-0.5 shrink-0" />
					<p class="text-error">{peopleError}</p>
				</div>
			{/if}

			<div class="mt-auto pt-2">
				<input
					bind:this={peopleFileInput}
					type="file"
					accept=".csv"
					class="sr-only"
					aria-label="Select people CSV file"
					onchange={handlePeopleFile}
				/>
				<Button
					variant="outline"
					disabled={!onImportPeople}
					loading={peopleImporting}
					onclick={() => peopleFileInput?.click()}
				>
					<UploadSimpleIcon />
					Import CSV
				</Button>
			</div>
		</div>

		<!-- Locations dataset card -->
		<div class="rounded-xl border border-outline bg-surface-container p-6 flex flex-col gap-4">
			<div class="flex items-center gap-3">
				<div class="flex items-center justify-center rounded-lg bg-primary/10 p-2.5">
					<MapPinIcon class="size-5 text-primary" />
				</div>
				<div>
					<h2 class="text-base font-medium text-on-surface">Locations</h2>
					<p class="text-sm text-on-surface-subtle">
						{formatCount(displayLocationsCount, 'record', 'records')}
					</p>
				</div>
			</div>

			<p class="text-sm text-on-surface-subtle">
				Import addresses from a CSV file. Supported columns:
				<code class="text-xs bg-surface-container-high rounded px-1 py-0.5">name</code>,
				<code class="text-xs bg-surface-container-high rounded px-1 py-0.5">address_line_1</code>,
				<code class="text-xs bg-surface-container-high rounded px-1 py-0.5">address_line_2</code>,
				<code class="text-xs bg-surface-container-high rounded px-1 py-0.5">address_line_3</code>,
				<code class="text-xs bg-surface-container-high rounded px-1 py-0.5">city</code>,
				<code class="text-xs bg-surface-container-high rounded px-1 py-0.5">state_or_region</code>,
				<code class="text-xs bg-surface-container-high rounded px-1 py-0.5">postal_code</code>,
				<code class="text-xs bg-surface-container-high rounded px-1 py-0.5">country_code</code>
				(2-letter ISO),
				<code class="text-xs bg-surface-container-high rounded px-1 py-0.5">latitude</code>,
				<code class="text-xs bg-surface-container-high rounded px-1 py-0.5">longitude</code>.
				Include <code class="text-xs bg-surface-container-high rounded px-1 py-0.5">latitude</code> and
				<code class="text-xs bg-surface-container-high rounded px-1 py-0.5">longitude</code> to enable turf cutting.
			</p>

			{#if locationsResult}
				<div
					class="rounded-lg border border-outline bg-surface-container-low p-3 text-sm flex items-start gap-2"
					role="status"
					aria-live="polite"
				>
					<CheckCircleIcon class="size-4 text-green-600 mt-0.5 shrink-0" />
					<div>
						<p class="font-medium text-on-surface">
							{locationsResult.imported.toLocaleString()} imported
							{#if locationsResult.skipped > 0}
								, {locationsResult.skipped.toLocaleString()} skipped
							{/if}
						</p>
						{#if locationsResult.errors.length > 0}
							<ul class="mt-1 space-y-0.5 text-on-surface-subtle">
								{#each locationsResult.errors.slice(0, 5) as err}
									<li>Row {err.row}: {err.reason}</li>
								{/each}
								{#if locationsResult.errors.length > 5}
									<li>...and {locationsResult.errors.length - 5} more row errors</li>
								{/if}
							</ul>
						{/if}
					</div>
				</div>
			{/if}

			{#if locationsError}
				<div
					class="rounded-lg border border-error/30 bg-error/5 p-3 text-sm flex items-start gap-2"
					role="alert"
				>
					<WarningCircleIcon class="size-4 text-error mt-0.5 shrink-0" />
					<p class="text-error">{locationsError}</p>
				</div>
			{/if}

			<div class="mt-auto pt-2">
				<input
					bind:this={locationsFileInput}
					type="file"
					accept=".csv"
					class="sr-only"
					aria-label="Select locations CSV file"
					onchange={handleLocationsFile}
				/>
				<Button
					variant="outline"
					disabled={!onImportLocations}
					loading={locationsImporting}
					onclick={() => locationsFileInput?.click()}
				>
					<UploadSimpleIcon />
					Import CSV
				</Button>
			</div>
		</div>
	</div>
</div>
