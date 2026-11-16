<script lang="ts">
	import QRCode from 'qrcode';
	import ConfirmDialog from '$components/feedback/confirm-dialog/ConfirmDialog.svelte';

	/** A modal that shows a QR code for a link and lets the person download it as a PNG. */
	interface Props {
		open: boolean;
		/** What the QR code holds, such as an invite URL. */
		value: string;
		title?: string;
		/** Names the downloaded file. @default 'qr-code.png' */
		filename?: string;
		onClose: () => void;
	}

	const { open, value, title = 'QR code', filename = 'qr-code.png', onClose }: Props = $props();

	/** The PNG as a data URL, made large enough to print. Empty until it is ready. */
	let dataUrl = $state('');
	let failed = $state(false);

	$effect(() => {
		if (!open || !value) return;
		let current = true;
		dataUrl = '';
		failed = false;
		QRCode.toDataURL(value, { width: 1024, margin: 2 })
			.then((url) => {
				if (current) dataUrl = url;
			})
			.catch(() => {
				if (current) failed = true;
			});
		return () => {
			current = false;
		};
	});

	function download() {
		if (!dataUrl) return;
		const link = document.createElement('a');
		link.href = dataUrl;
		link.download = filename;
		link.click();
	}
</script>

<ConfirmDialog
	{open}
	{title}
	confirmLabel="Download PNG"
	cancelLabel="Close"
	onConfirm={download}
	onCancel={onClose}
	error={failed ? 'The QR code could not be made.' : null}
>
	<div class="flex justify-center">
		{#if dataUrl}
			<img src={dataUrl} alt="QR code for {value}" class="size-64 rounded-sm bg-white" />
		{:else if !failed}
			<div class="size-64 animate-pulse rounded-sm bg-surface-container" aria-hidden="true"></div>
		{/if}
	</div>
</ConfirmDialog>
