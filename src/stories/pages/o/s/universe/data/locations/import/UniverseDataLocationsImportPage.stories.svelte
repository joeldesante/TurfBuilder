<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import UniverseDataLocationsImportPage from './UniverseDataLocationsImportPage.svelte';

	const { Story } = defineMeta({
		title: 'Pages/O/S/Universe/Data/Locations/Import',
		component: UniverseDataLocationsImportPage,
		tags: ['autodocs']
	});
</script>

<Story
	name="CSV"
	args={{
		orgSlug: 'demo-org',
		source: 'csv',
		onImportCsv: async () => ({ imported: 42, skipped: 3, errors: [] })
	}}
/>

<Story
	name="Google Sheets"
	args={{
		orgSlug: 'demo-org',
		source: 'google-sheets',
		onImportGoogleSheets: async () => ({ imported: 18, skipped: 0, errors: [] })
	}}
/>

<Story
	name="Overture"
	args={{
		orgSlug: 'demo-org',
		source: 'overture',
		onImportOverture: async () => ({ imported: 1204, skipped: 0, errors: [] })
	}}
/>

<Story
	name="With errors"
	args={{
		orgSlug: 'demo-org',
		source: 'csv',
		onImportCsv: async () => ({
			imported: 10,
			skipped: 2,
			errors: [
				{ row: 3, reason: 'Missing address_line_1' },
				{ row: 7, reason: 'Invalid country_code' }
			]
		})
	}}
/>

<Story
	name="No handler (disabled)"
	args={{
		orgSlug: 'demo-org',
		source: 'csv'
	}}
/>
