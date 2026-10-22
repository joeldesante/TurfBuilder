<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import InfraEmailTemplateEditorPage from './InfraEmailTemplateEditorPage.svelte';
	import { templateDetail } from './fixtures';

	const { Story } = defineMeta({
		title: 'Pages/Infra/Email template editor',
		component: InfraEmailTemplateEditorPage,
		tags: ['autodocs'],
		args: {
			template: templateDetail,
			onsave: async () => {},
			ontest: async () => 'Sent a test email to you@example.com.',
			onreset: async () => {}
		},
		parameters: { layout: 'fullscreen', docs: { subtitle: 'Edit one email with a live preview filled with sample values.' } }
	});
</script>

<Story name="Edited" />

<Story name="Default text" args={{ template: { ...templateDetail, customized: false } }} />
