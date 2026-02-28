<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import CreateSurvey from './CreateSurvey.svelte';

	const { Story } = defineMeta({
		title: 'Pages/System/Data/Surveys/Create Survey',
		component: CreateSurvey,
		tags: ['autodocs'],
		parameters: {
			docs: {
				subtitle: 'Form for creating a new survey with name validation.'
			}
		}
	});
</script>

<Story name="Default" asChild>
	<CreateSurvey />
</Story>
