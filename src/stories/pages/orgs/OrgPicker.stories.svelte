<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import OrgPicker from './OrgPicker.svelte';

	const { Story } = defineMeta({
		title: 'Pages/Orgs/OrgPicker',
		component: OrgPicker,
		tags: ['autodocs'],
		parameters: {
			layout: 'fullscreen',
			docs: {
				subtitle: 'Organization selection page shown to users who belong to multiple organizations.'
			}
		}
	});

	const sampleOrgs = [
		{ id: '1', name: 'North West Philly Alliance', slug: 'north-west-philly-alliance' },
		{ id: '2', name: 'South Side Organizers', slug: 'south-side-organizers' },
		{ id: '3', name: 'Kensington Community', slug: 'kensington-community' }
	];

	function noop() {}
</script>

<Story name="Multiple Orgs" args={{ orgs: sampleOrgs, onSelect: noop }} />

<Story
	name="Single Org"
	args={{ orgs: [sampleOrgs[0]], onSelect: noop }}
/>

<Story name="No Orgs" args={{ orgs: [], onSelect: noop }} />
