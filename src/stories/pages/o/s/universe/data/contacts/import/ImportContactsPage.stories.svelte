<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import ImportContactsPage from './ImportContactsPage.svelte';

	const { Story } = defineMeta({
		title: 'Pages/O/S/Universe/Data/Contacts/Import',
		component: ImportContactsPage,
		tags: ['autodocs']
	});
</script>

<Story name="Default" args={{ orgSlug: 'acme' }} />

<Story
	name="With uploaded files"
	args={{
		orgSlug: 'acme',
		onLoadImport: async () => ({
			url: 'data:text/csv,Name%2CPhone%0AAda%2C555-0100',
			rowIndex: null
		}),
		imports: [
			{
				id: 'i1',
				file_name: 'people.csv',
				size_bytes: 3_670_016,
				row_count: 250_000,
				uploaded_at: '2026-11-13T15:00:00.000Z',
				expires_at: '2026-12-13T15:00:00.000Z',
				preserved: false
			},
			{
				id: 'i2',
				file_name: 'donors.csv',
				size_bytes: 2_000,
				row_count: null,
				uploaded_at: '2026-10-01T15:00:00.000Z',
				expires_at: '2026-10-31T15:00:00.000Z',
				preserved: false
			},
			{
				id: 'i3',
				file_name: 'archive.csv',
				size_bytes: 10_485_760,
				row_count: 12,
				uploaded_at: '2026-08-01T15:00:00.000Z',
				expires_at: '2026-08-31T15:00:00.000Z',
				preserved: true
			}
		]
	}}
/>

<Story name="Not configured" args={{ orgSlug: 'acme', available: false }} />
