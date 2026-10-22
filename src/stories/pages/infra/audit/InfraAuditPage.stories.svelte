<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import InfraAuditPage from './InfraAuditPage.svelte';
	import { auditPage } from './fixtures';

	const { Story } = defineMeta({
		title: 'Pages/Infra/Audit log',
		component: InfraAuditPage,
		tags: ['autodocs'],
		args: { onfilter: () => {} },
		parameters: { layout: 'fullscreen', docs: { subtitle: 'Every change an infrastructure admin has made, filterable by kind, target, and date.' } }
	});
</script>

<Story name="Audit log" args={{ page: auditPage, filters: {} }} />

<Story name="Filtered" args={{ page: { ...auditPage, items: [auditPage.items[0]], totalCount: 1 }, filters: { action: 'user.suspend', from: '2026-10-01' } }} />

<Story name="No matches" args={{ page: { ...auditPage, items: [], totalCount: 0 }, filters: { targetType: 'session' } }} />
