<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import MemberDetailPage from './MemberDetailPage.svelte';

	const { Story } = defineMeta({
		title: 'Pages/Orgs/Member Detail',
		component: MemberDetailPage,
		tags: ['autodocs'],
		parameters: { layout: 'fullscreen' }
	});
</script>

<Story
	name="Default"
	args={{
		userId: 'user-1',
		name: 'Jane Smith',
		email: 'jane@example.com',
		orgSlug: 'my-org',
		permissions: [
			{ id: 'p1', key: 'turf.read', label: 'View Turfs', group: 'Turfs', description: null, value: null },
			{ id: 'p2', key: 'turf.create', label: 'Cut New Turfs', group: 'Turfs', description: null, value: true },
			{ id: 'p3', key: 'survey.read', label: 'View Surveys', group: 'Surveys', description: null, value: false },
		],
		onSetPermission: async () => {}
	}}
/>
