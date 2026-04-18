<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import InfraDashboard from './InfraDashboard.svelte';

	const { Story } = defineMeta({
		title: 'Pages/Infra/Dashboard',
		component: InfraDashboard,
		tags: ['autodocs']
	});
</script>

<Story
	name="Full Access"
	args={{ infraPermissions: ['access', 'users.manage', 'locations.overture_sync'] }}
/>

<Story
	name="Access Only"
	args={{ infraPermissions: ['access'] }}
/>

<Story
	name="Partial Access"
	args={{ infraPermissions: ['access', 'users.manage'] }}
/>
