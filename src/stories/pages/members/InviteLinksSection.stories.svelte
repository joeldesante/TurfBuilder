<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import InviteLinksSection from './InviteLinksSection.svelte';

	const { Story } = defineMeta({
		title: 'Pages/Orgs/Members/InviteLinksSection',
		component: InviteLinksSection,
		tags: ['autodocs'],
		parameters: {
			layout: 'padded',
			docs: {
				subtitle: 'Owner-only section for managing org invite links.'
			}
		}
	});

	const sampleLinks = [
		{ id: 'V1StGXR8_Z5jdHi6B-myT', created_at: '2026-03-01T00:00:00Z', expires_at: null },
		{ id: 'abc123xyz_DEFGH456789', created_at: '2026-03-10T00:00:00Z', expires_at: '2026-04-10T00:00:00Z' }
	];

	async function noop() {}
</script>

<Story
	name="With Links, Slug Off"
	args={{
		inviteLinks: sampleLinks,
		slugInviteEnabled: false,
		orgSlug: 'north-west-philly-alliance',
		onCreate: noop,
		onRevoke: noop,
		onToggleSlug: noop
	}}
/>

<Story
	name="With Links, Slug On"
	args={{
		inviteLinks: sampleLinks,
		slugInviteEnabled: true,
		orgSlug: 'north-west-philly-alliance',
		onCreate: noop,
		onRevoke: noop,
		onToggleSlug: noop
	}}
/>

<Story
	name="Empty"
	args={{
		inviteLinks: [],
		slugInviteEnabled: false,
		orgSlug: 'north-west-philly-alliance',
		onCreate: noop,
		onRevoke: noop,
		onToggleSlug: noop
	}}
/>
