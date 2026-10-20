<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import InfraQuickMenu from './InfraQuickMenu.svelte';
	import { buildInfraNav } from '$lib/shared/utils/infra-nav';
	import { INFRA_PERMISSIONS } from '$lib/shared/types/infra';

	const links = [
		{ label: 'Analytics', url: 'https://analytics.example.com' },
		{ label: 'Tracing', url: 'http://localhost:16686' }
	];

	const { Story } = defineMeta({
		title: 'Components/Actions/InfraQuickMenu',
		component: InfraQuickMenu,
		tags: ['autodocs'],
		argTypes: {
			groups: { control: false, description: 'The infra pages and external tools the admin can open.' },
			currentOrg: { control: 'object', description: 'The organization being viewed, for a shortcut to its infra page.' },
			open: { control: 'boolean' }
		},
		parameters: {
			docs: {
				subtitle:
					'A floating button, shown only to infrastructure admins, that opens a menu of infra pages, a user and organization finder, and external tools. Alt+I toggles it.'
			}
		}
	});
</script>

<Story name="Full access" args={{ groups: buildInfraNav([...INFRA_PERMISSIONS], links), open: true }} />

<Story
	name="On an organization page"
	args={{
		groups: buildInfraNav([...INFRA_PERMISSIONS], links),
		currentOrg: { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', name: 'Riverside Canvass' },
		open: true
	}}
/>

<Story name="Read-only admin" args={{ groups: buildInfraNav(['access']), open: true }} />
