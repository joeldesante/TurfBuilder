<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import LocationForm from './LocationForm.svelte';

	const { Story } = defineMeta({
		title: 'Components/DataInputs/LocationForm',
		component: LocationForm,
		args: {
			coordinates: { latitude: 39.9526, longitude: -75.1652 },
			onSubmit: async () => {},
			onCancel: () => {}
		}
	});
</script>

<Story name="Create" args={{}} />

<Story
	name="Edit"
	args={{
		submitLabel: 'Save changes',
		initialValues: {
			name: 'Rosa Deli',
			address_line_1: '123 Main St',
			city: 'Philadelphia',
			state_or_region: 'PA',
			postal_code: '19104',
			country_code: 'US'
		}
	}}
/>

<Story
	name="Volunteer Suggestion"
	args={{
		submitLabel: 'Add business',
		instructions:
			'Add the business you found. Photograph its name and address so an organizer can verify the details.'
	}}
/>
