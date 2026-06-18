<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import MembersPage from './MembersPage.svelte';

	const { Story } = defineMeta({
		title: 'Pages/Orgs/Members',
		component: MembersPage,
		tags: ['autodocs'],
		parameters: {
			layout: 'fullscreen',
			docs: {
				subtitle: 'Organization members management page for staff.'
			}
		}
	});

	const sampleMembers = [
		{ id: '1', name: 'Alice Johnson', email: 'alice@example.com', role_id: 'r1', role_name: 'Owner' },
		{ id: '2', name: 'Bob Smith', email: 'bob@example.com', role_id: 'r2', role_name: 'Member' },
		{ id: '3', name: 'Carol White', email: 'carol@example.com', role_id: null, role_name: null }
	];

	const sampleLinks = [
		{ id: 'V1StGXR8_Z5jdHi6B-myT', created_at: '2026-03-01T00:00:00Z', expires_at: null },
		{ id: 'abc123xyz_DEFGH456789', created_at: '2026-03-10T00:00:00Z', expires_at: '2026-04-10T00:00:00Z' }
	];

	async function noop() {}
</script>

<Story
	name="Owner View"
	args={{
		members: sampleMembers,
		canRemoveMembers: true,
		canInvite: true,
		inviteLinks: sampleLinks,
		slugInviteEnabled: false,
		orgSlug: 'north-west-philly-alliance',
		onRemove: noop,
		onCreateLink: noop,
		onRevokeLink: noop,
		onToggleSlugInvite: noop
	}}
/>

<Story
	name="Owner View Slug Enabled"
	args={{
		members: sampleMembers,
		canRemoveMembers: true,
		canInvite: true,
		inviteLinks: sampleLinks,
		slugInviteEnabled: true,
		orgSlug: 'north-west-philly-alliance',
		onRemove: noop,
		onCreateLink: noop,
		onRevokeLink: noop,
		onToggleSlugInvite: noop
	}}
/>

<Story
	name="Read-only View"
	args={{
		members: sampleMembers,
		canRemoveMembers: false,
		canInvite: false,
		inviteLinks: [],
		slugInviteEnabled: false,
		orgSlug: 'north-west-philly-alliance',
		onRemove: noop,
		onCreateLink: noop,
		onRevokeLink: noop,
		onToggleSlugInvite: noop
	}}
/>

<Story
	name="Empty"
	args={{
		members: [],
		canRemoveMembers: true,
		canInvite: true,
		inviteLinks: [],
		slugInviteEnabled: false,
		orgSlug: 'north-west-philly-alliance',
		onRemove: noop,
		onCreateLink: noop,
		onRevokeLink: noop,
		onToggleSlugInvite: noop
	}}
/>
