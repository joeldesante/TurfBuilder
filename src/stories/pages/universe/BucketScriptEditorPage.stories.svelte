<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import BucketScriptEditorPage from './BucketScriptEditorPage.svelte';

	const { Story } = defineMeta({
		title: 'Pages/Universe/BucketScriptEditor',
		component: BucketScriptEditorPage,
		tags: ['autodocs']
	});
</script>

<Story name="Default" args={{ scriptName: 'Door Knock Script', bucketName: 'Registered Voters' }} />
