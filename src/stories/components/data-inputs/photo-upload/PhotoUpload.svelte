<script lang="ts" module>
	export interface Props {
		/** Object keys of the uploaded photos. Bindable. */
		keys?: string[];
		/** Org slug, used to build the presign and read URLs. */
		orgSlug: string;
		max?: number;
		label?: string;
		helperText?: string;
		disabled?: boolean;
	}

	/** Longest edge after downscaling. Enough to read a shopfront sign. */
	const MAX_EDGE = 1600;
	const QUALITY = 0.8;
	const OUTPUT_TYPE = 'image/webp';
</script>

<script lang="ts">
	import Button from '$components/actions/button/Button.svelte';
	import Spinner from '$components/feedback/spinner/Spinner.svelte';
	import CameraIcon from 'phosphor-svelte/lib/Camera';
	import TrashIcon from 'phosphor-svelte/lib/Trash';

	let {
		keys = $bindable([]),
		orgSlug,
		max = 3,
		label = 'Photos',
		helperText = 'Photograph the business name and address so an organizer can verify the details.',
		disabled = false
	}: Props = $props();

	let fileInput = $state<HTMLInputElement | undefined>();
	let uploading = $state(false);
	let error = $state<string | null>(null);

	const remaining = $derived(max - keys.length);

	/**
	 * Downscales and re-encodes a photo in the browser.
	 *
	 * Canvassers are on phone data, and a modern phone camera produces several
	 * megabytes per shot; this brings a typical photo under a few hundred
	 * kilobytes before it ever leaves the device.
	 */
	async function compress(file: File): Promise<Blob> {
		const bitmap = await createImageBitmap(file);
		const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
		const canvas = document.createElement('canvas');
		canvas.width = Math.round(bitmap.width * scale);
		canvas.height = Math.round(bitmap.height * scale);

		const context = canvas.getContext('2d');
		if (!context) throw new Error('Could not process the image.');
		context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
		bitmap.close();

		const blob = await new Promise<Blob | null>((resolve) =>
			canvas.toBlob(resolve, OUTPUT_TYPE, QUALITY)
		);
		if (!blob) throw new Error('Could not process the image.');
		return blob;
	}

	async function upload(blob: Blob): Promise<string> {
		const presignResponse = await fetch(`/o/${orgSlug}/uploads/presign`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ contentType: blob.type, contentLength: blob.size })
		});
		if (!presignResponse.ok) {
			const body = await presignResponse.json().catch(() => ({}));
			throw new Error(body.error ?? 'Could not start the upload.');
		}

		const { url, key } = await presignResponse.json();
		const putResponse = await fetch(url, {
			method: 'PUT',
			headers: { 'Content-Type': blob.type },
			body: blob
		});
		if (!putResponse.ok) throw new Error('Upload failed. Check your connection and try again.');

		return key;
	}

	async function handleFiles(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const selected = Array.from(input.files ?? []).slice(0, remaining);
		input.value = '';
		if (selected.length === 0) return;

		uploading = true;
		error = null;
		try {
			for (const file of selected) {
				keys = [...keys, await upload(await compress(file))];
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Upload failed.';
		} finally {
			uploading = false;
		}
	}

	function remove(key: string) {
		keys = keys.filter((k) => k !== key);
	}
</script>

<div class="flex flex-col gap-1.5">
	<span class="text-sm font-medium text-on-surface">{label}</span>
	<p class="text-xs text-on-surface-subtle">{helperText}</p>

	{#if keys.length > 0}
		<ul class="mt-1 flex flex-wrap gap-2">
			{#each keys as key (key)}
				<li class="relative">
					<img
						src="/o/{orgSlug}/uploads/{key}"
						alt="Uploaded photo of the business"
						class="size-20 rounded-md border border-outline-subtle object-cover"
					/>
					<button
						type="button"
						aria-label="Remove photo"
						{disabled}
						onclick={() => remove(key)}
						class="absolute -right-1.5 -top-1.5 inline-flex size-6 items-center justify-center rounded-full bg-error text-on-error shadow"
					>
						<TrashIcon size={12} weight="bold" />
					</button>
				</li>
			{/each}
		</ul>
	{/if}

	<input
		bind:this={fileInput}
		type="file"
		accept="image/*"
		capture="environment"
		multiple
		class="hidden"
		data-testid="photo-upload-input"
		onchange={handleFiles}
	/>

	<div class="mt-1 flex items-center gap-2">
		<Button
			variant="outline"
			size="sm"
			type="button"
			disabled={disabled || uploading || remaining <= 0}
			onclick={() => fileInput?.click()}
		>
			{#if uploading}
				<Spinner size={14} />
				Uploading...
			{:else}
				<CameraIcon />
				Add photo
			{/if}
		</Button>
		<span class="text-xs text-on-surface-subtle">
			{keys.length} of {max} added
		</span>
	</div>

	{#if error}
		<p role="alert" class="text-xs text-error">{error}</p>
	{/if}
</div>
