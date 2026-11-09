<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import PhotoUpload from './PhotoUpload.svelte';

	const { Story } = defineMeta({
		title: 'Components/Data Inputs/PhotoUpload',
		component: PhotoUpload,
		args: { orgId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }
	});
</script>

<Story name="Empty" args={{ keys: [] }} />

<Story name="Partially Filled" args={{ keys: ['orgs/o1/locations/a.webp'] }} />

<!-- At the cap the add button is disabled. -->
<Story
	name="Full"
	args={{
		keys: [
			'orgs/o1/locations/a.webp',
			'orgs/o1/locations/b.webp',
			'orgs/o1/locations/c.webp'
		]
	}}
/>

<Story name="Disabled" args={{ keys: ['orgs/o1/locations/a.webp'], disabled: true }} />
