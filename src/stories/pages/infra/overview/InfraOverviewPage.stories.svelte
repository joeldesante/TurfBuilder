<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import InfraOverviewPage from './InfraOverviewPage.svelte';
	import { overview, permissions } from './fixtures';

	const { Story } = defineMeta({
		title: 'Pages/Infra/Overview',
		component: InfraOverviewPage,
		tags: ['autodocs'],
		parameters: {
			layout: 'fullscreen',
			docs: { subtitle: 'The infrastructure admin landing page: platform health, headline figures, and recent changes.' }
		}
	});
</script>

<Story name="Healthy" args={{ overview, permissions }} />

<Story
	name="Needs attention"
	args={{
		overview: {
			...overview,
			status: { mailConfigured: false, storageConfigured: true, migrationNeeded: true, failedEmails24h: 4, failedDocuments24h: 1 }
		},
		permissions
	}}
/>

<Story name="Without audit access" args={{ overview: { ...overview, recentAudit: null }, permissions: ['access'] }} />

<Story name="New install" args={{ overview: { ...overview, users: 1, recentUsers: [], recentOrgs: [], growth: [], externalLinks: [] }, permissions }} />
