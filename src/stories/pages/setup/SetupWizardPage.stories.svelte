<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import SetupWizardPage from './SetupWizardPage.svelte';

	const { Story } = defineMeta({
		title: 'Pages/Setup/SetupWizardPage',
		component: SetupWizardPage,
		parameters: {
			layout: 'fullscreen'
		}
	});
</script>

<Story name="Default" />
