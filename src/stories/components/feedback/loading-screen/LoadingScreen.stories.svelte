<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import LoadingScreen from './LoadingScreen.svelte';

	const { Story } = defineMeta({
		title: 'Components/Feedback/LoadingScreen',
		component: LoadingScreen,
		tags: ['autodocs'],
		parameters: {
			layout: 'fullscreen'
		}
	});
</script>

<Story name="Default" args={{ delay: 0 }} />

<Story name="SmallLogo" args={{ delay: 0, logoWidth: 80 }} />

<Story name="DelayedAppearance" args={{ delay: 1500 }} />
