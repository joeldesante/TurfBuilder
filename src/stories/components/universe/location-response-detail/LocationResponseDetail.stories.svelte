<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import LocationResponseDetail from './LocationResponseDetail.svelte';

	const { Story } = defineMeta({
		title: 'Components/Universe/LocationResponseDetail',
		component: LocationResponseDetail,
		tags: ['autodocs']
	});

	const sampleLocation = {
		id: 'public:loc-1',
		name: 'Community Center',
		address_line_1: '100 Main St',
		city: 'Philadelphia',
		latitude: 40.0259,
		longitude: -75.2238,
		questions: [
			{
				id: 'q1',
				text: 'Will you vote in the upcoming election?',
				type: 'single_choice',
				choices: ['Yes', 'No', 'Undecided'],
				responses: [
					{ value: 'Yes', respondedAt: '2026-06-01T14:32:00.000Z', respondedBy: 'alice' },
					{ value: 'Undecided', respondedAt: '2026-06-03T09:10:00.000Z', respondedBy: 'bob' }
				]
			},
			{
				id: 'q2',
				text: 'Any concerns you would like to share?',
				type: 'text',
				choices: [],
				responses: []
			}
		]
	};

	const emptyLocation = {
		id: 'public:loc-2',
		name: 'Public Library',
		address_line_1: '250 Market St',
		city: 'Philadelphia',
		latitude: 40.031,
		longitude: -75.218,
		questions: []
	};
</script>

<Story name="Default" args={{ location: sampleLocation, onClose: () => {} }} />

<Story name="No Responses" args={{ location: emptyLocation, onClose: () => {} }} />
