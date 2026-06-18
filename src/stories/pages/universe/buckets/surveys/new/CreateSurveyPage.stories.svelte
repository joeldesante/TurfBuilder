<script module lang="ts">
	export const meta = {
		title: 'Pages/Universe/Bucket/CreateSurveyPage'
	};
</script>

<script lang="ts">
	import { Story } from '@storybook/addon-svelte-csf';
	import CreateSurveyPage from './CreateSurveyPage.svelte';

	async function noop() {
		await new Promise((r) => setTimeout(r, 500));
	}
</script>

<Story name="Default">
	<CreateSurveyPage onCreate={noop} />
</Story>
