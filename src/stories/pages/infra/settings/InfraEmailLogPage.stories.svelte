<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import InfraEmailLogPage from './InfraEmailLogPage.svelte';
	import { emailLogPage } from './fixtures';

	const { Story } = defineMeta({
		title: 'Pages/Infra/Email log',
		component: InfraEmailLogPage,
		tags: ['autodocs'],
		args: { templates: ['auth.reset_password', 'auth.verify_email'], onfilter: () => {} },
		parameters: { layout: 'fullscreen', docs: { subtitle: 'Every email the app tried to send, filterable by status, template, and address.' } }
	});
</script>

<Story name="Email log" args={{ page: emailLogPage, filters: {} }} />

<Story name="Failures only" args={{ page: { ...emailLogPage, items: [emailLogPage.items[1]], totalCount: 1 }, filters: { status: 'failed' } }} />

<Story name="No matches" args={{ page: { ...emailLogPage, items: [], totalCount: 0 }, filters: { recipient: 'nobody@example.com' } }} />
