<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import InfraAdminsPage from './InfraAdminsPage.svelte';
	import { admins, candidates, roles } from './fixtures';

	const { Story } = defineMeta({
		title: 'Pages/Infra/Admins',
		component: InfraAdminsPage,
		tags: ['autodocs'],
		args: {
			admins,
			roles,
			currentUserId: admins[0].id,
			onsearch: async () => candidates,
			ongrant: async () => {},
			onrevoke: async () => {}
		},
		parameters: { layout: 'fullscreen', docs: { subtitle: 'Who holds an infrastructure role, what each role allows, and a way to add or remove admins.' } }
	});
</script>

<Story name="Admins" />

<Story name="Only one admin" args={{ admins: [admins[0]] }} />
