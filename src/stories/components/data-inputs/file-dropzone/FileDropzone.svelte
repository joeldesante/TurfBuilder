<script lang="ts">
	import Button from '$components/actions/button/Button.svelte';
	import UploadSimpleIcon from 'phosphor-svelte/lib/UploadSimple';
	import FileCsvIcon from 'phosphor-svelte/lib/FileCsv';

	/**
	 * A drop zone with an upload button inside it, for choosing one CSV file. The button is the keyboard and screen reader route to the file browser; mouse users can also click anywhere in the zone. When
	 * `onUpload` is given the file is sent as soon as it is dropped or chosen,
	 * and the whole zone fills left to right as the progress bar.
	 */
	interface Props {
		/**
		 * Sends the file. Call `onProgress` with 0 to 100 as it goes. A rejection
		 * is shown under the zone, so its message must be safe to show a user.
		 */
		onUpload?: (file: File, onProgress: (percent: number) => void) => Promise<void>;
		/** Disables the drop zone and the button. @default false */
		disabled?: boolean;
	}

	const { onUpload, disabled = false }: Props = $props();

	let fileInput = $state<HTMLInputElement | undefined>();
	let dragging = $state(false);
	/** True while a file that is not a CSV is held over the zone. */
	let wrongType = $state(false);
	let error = $state('');
	let file = $state<File | null>(null);
	let status = $state<'idle' | 'uploading' | 'done'>('idle');
	let progress = $state(0);

	const busy = $derived(disabled || status === 'uploading');

	function isCsv(candidate: File): boolean {
		return candidate.name.toLowerCase().endsWith('.csv');
	}

	async function accept(candidate: File | undefined) {
		if (!candidate || busy) return;
		if (!isCsv(candidate)) {
			error = 'The file must be a CSV (a .csv file).';
			return;
		}
		error = '';
		file = candidate;
		progress = 0;
		if (!onUpload) {
			status = 'done';
			return;
		}

		status = 'uploading';
		try {
			await onUpload(candidate, (percent) => (progress = Math.max(0, Math.min(100, percent))));
			progress = 100;
			status = 'done';
		} catch (e) {
			error = e instanceof Error ? e.message : 'The upload failed. Try again.';
			file = null;
			status = 'idle';
		}
	}

	// The browser hides file names until the drop, so a dragged file is judged by its type.
	// An empty type is unknown and counts as fine; the name is checked on drop.
	const CSV_TYPES = ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel'];

	function isWrongType(event: DragEvent): boolean {
		const items = Array.from(event.dataTransfer?.items ?? []);
		return items.some(
			(item) => item.kind !== 'file' || (item.type !== '' && !CSV_TYPES.includes(item.type))
		);
	}

	function handleDragLeave() {
		dragging = false;
		wrongType = false;
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		dragging = false;
		wrongType = false;
		accept(event.dataTransfer?.files?.[0]);
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		if (busy) return;
		dragging = true;
		wrongType = isWrongType(event);
	}

	function openBrowser() {
		if (!busy) fileInput?.click();
	}

	/** The button is the keyboard route; stop its click from also reaching the zone's own click. */
	function handleButtonClick(event: MouseEvent) {
		event.stopPropagation();
		openBrowser();
	}

	function handleChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		accept(input.files?.[0]);
		input.value = '';
	}
</script>

<div class="flex w-full flex-col items-center gap-3">
	<div
		data-testid="file-dropzone"
		class={[
			'relative flex w-full cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors duration-150',
			dragging && wrongType && 'border-error bg-error/10',
			dragging && !wrongType && 'border-success bg-success/10',
			!dragging && 'border-outline bg-transparent',
			!dragging && !busy && 'hover:bg-surface-container active:bg-surface-container-high',
			disabled && 'cursor-not-allowed opacity-50',
			status === 'uploading' && 'cursor-progress'
		]}
		ondragover={handleDragOver}
		ondragleave={handleDragLeave}
		ondrop={handleDrop}
		onclick={openBrowser}
	>
		{#if status === 'uploading' || status === 'done'}
			<div
				role="progressbar"
				aria-label="Upload progress"
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={progress}
				data-testid="file-dropzone-progress"
				class="absolute inset-y-0 left-0 bg-success/25 transition-[width] duration-200 ease-out"
				style:width="{progress}%"
			></div>
		{/if}

		<div class="relative flex flex-col items-center gap-2">
			<FileCsvIcon size={40} class="text-on-surface-subtle" />
			{#if status === 'uploading'}
				<p class="text-sm font-medium text-on-surface">Uploading {file?.name}</p>
				<p class="text-sm text-on-surface-subtle">{progress}%</p>
			{:else if status === 'done'}
				<p class="text-sm font-medium text-on-surface">{file?.name}</p>
				<p class="text-sm text-on-surface-subtle">Uploaded</p>
			{:else}
				<p class="text-sm font-medium text-on-surface">Drop a CSV file here, or click Upload</p>
			{/if}
			<Button variant="outline" disabled={busy} onclick={handleButtonClick}>
				<UploadSimpleIcon />
				Upload CSV
			</Button>
		</div>
	</div>

	{#if error}
		<p role="alert" class="text-sm text-error">{error}</p>
	{/if}

	<input
		bind:this={fileInput}
		type="file"
		accept=".csv,text/csv"
		class="hidden"
		data-testid="file-dropzone-input"
		disabled={busy}
		onchange={handleChange}
	/>
</div>
