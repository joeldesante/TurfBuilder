<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import QrCodeDialog from './QrCodeDialog.svelte';

	const { Story } = defineMeta({
		title: 'Components/Feedback/QrCodeDialog',
		component: QrCodeDialog,
		tags: ['autodocs']
	});
</script>

<Story
	name="Open"
	args={{
		open: true,
		value: 'https://example.com/invite/V1StGXR8_Z5jdHi6B-myT',
		title: 'Invite link QR code',
		filename: 'invite-link-qr.png',
		onClose: () => {}
	}}
/>
