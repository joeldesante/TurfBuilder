<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import InfraSystemPage from './InfraSystemPage.svelte';
	import { health, permissions } from './fixtures';

	const { Story } = defineMeta({
		title: 'Pages/Infra/System health',
		component: InfraSystemPage,
		tags: ['autodocs'],
		parameters: { layout: 'fullscreen', docs: { subtitle: 'Runtime, database, and dependency status for the running instance.' } }
	});
</script>

<Story name="Healthy" args={{ health, permissions }} />

<Story
	name="Needs attention"
	args={{
		health: {
			...health,
			database: { ...health.database, postgisVersion: null },
			status: { ...health.status, migrationNeeded: true, storageConfigured: false, emails24h: { sent: 3, skipped: 0, failed: 4 }, failedDocuments24h: 2 }
		},
		permissions
	}}
/>
