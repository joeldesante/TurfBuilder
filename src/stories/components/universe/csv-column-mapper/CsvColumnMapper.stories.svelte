<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import CsvColumnMapper from './CsvColumnMapper.svelte';

	const { Story } = defineMeta({
		title: 'Components/Universe/CsvColumnMapper',
		component: CsvColumnMapper,
		tags: ['autodocs']
	});

	const fields = [
		{ id: 'f1', name: 'name', type: 'text' as const, required: true },
		{ id: 'f2', name: 'phone', type: 'text' as const, required: false },
		{ id: 'f3', name: 'staff', type: 'number' as const, required: false }
	];
	const headers = ['Name', 'Phone #', 'Notes', 'Lat', 'Lng'];
	const samples = [
		['Corner Cafe', '555-0100', 'Closed Mondays', '40.01', '-75.21'],
		['Book Nook', '555-0101', '', '40.02', '-75.22']
	];
</script>

<Story
	name="Suggested"
	args={{
		headers,
		samples,
		fields,
		schemaName: 'Business',
		mapping: { f1: 0, f2: 1, 'contact.latitude': 3, 'contact.longitude': 4 }
	}}
/>

<Story
	name="Coordinates missing"
	args={{
		headers: ['Name', 'Phone #'],
		samples: [['Corner Cafe', '555-0100']],
		fields,
		schemaName: 'Business',
		mapping: { f1: 0, f2: 1 },
		errors: {
			'mapping.contact.latitude': ['Latitude needs a column'],
			'mapping.contact.longitude': ['Longitude needs a column']
		}
	}}
/>

<Story
	name="One column for two fields"
	args={{
		headers: ['Name', 'Address', 'Lat', 'Lng'],
		samples: [['Corner Cafe', '1 Main St', '30.27', '-97.74']],
		fields,
		schemaName: 'Business',
		mapping: {
			f1: 0,
			'contact.address_line_1': 1,
			'contact.address_line_2': 1,
			'contact.latitude': 2,
			'contact.longitude': 3
		}
	}}
/>
