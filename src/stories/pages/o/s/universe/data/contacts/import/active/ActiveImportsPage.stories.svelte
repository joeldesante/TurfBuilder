<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import ActiveImportsPage from './ActiveImportsPage.svelte';

	const { Story } = defineMeta({
		title: 'Pages/O/S/Universe/Data/Contacts/Import/Active',
		component: ActiveImportsPage,
		tags: ['autodocs']
	});

	const base = {
		file_id: 'f1',
		rows_skipped: 0,
		error: null,
		created_at: '2026-11-15T18:00:00.000Z',
		updated_at: '2026-11-15T18:05:00.000Z',
		finished_at: null
	};
</script>

<Story name="Empty" args={{ orgSlug: 'acme', jobs: [] }} />

<Story
	name="In progress and finished"
	args={{
		orgSlug: 'acme',
		jobs: [
			{
				...base,
				id: 'j1',
				file_name: 'people.csv',
				status: 'running',
				rows_total: 400000,
				rows_processed: 148500,
				started_at: '2026-11-15T18:01:00.000Z'
			},
			{
				...base,
				id: 'j2',
				file_name: 'donors.csv',
				status: 'queued',
				rows_total: 12000,
				rows_processed: 0,
				started_at: null
			},
			{
				...base,
				id: 'j3',
				file_name: 'volunteers.csv',
				status: 'completed',
				rows_total: 800,
				rows_processed: 800,
				rows_skipped: 14,
				started_at: '2026-11-14T10:00:00.000Z',
				finished_at: '2026-11-14T10:02:00.000Z'
			},
			{
				...base,
				id: 'j4',
				file_name: 'old-list.csv',
				status: 'failed',
				rows_total: 5000,
				rows_processed: 1500,
				error: 'The import stopped before it finished.',
				started_at: '2026-11-13T10:00:00.000Z',
				finished_at: '2026-11-13T10:01:00.000Z'
			}
		]
	}}
/>

<Story
	name="Rows not counted"
	args={{
		orgSlug: 'acme',
		jobs: [
			{
				...base,
				id: 'j1',
				file_name: 'uncounted.csv',
				status: 'running',
				rows_total: null,
				rows_processed: 2500,
				started_at: '2026-11-15T18:01:00.000Z'
			}
		]
	}}
/>
