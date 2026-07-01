<script module lang="ts">
	export const meta = {
		title: 'Pages/O/S/Universe/Buckets/Surveys/Editor'
	};
</script>

<script lang="ts">
	import { Story } from '@storybook/addon-svelte-csf';
	import BucketSurveyEditorPage from './BucketSurveyEditorPage.svelte';

	async function noop() {
		await new Promise((r) => setTimeout(r, 500));
	}
</script>

<Story name="With Questions">
	<BucketSurveyEditorPage
		surveyName="Door Knock Survey"
		surveyDescription="Used for door-to-door canvassing."
		bucketName="Swing District Voters"
		questions={[
			{ db_id: '1', type: 'text', text: 'What is your top concern?', choices: [], index: 0 },
			{ db_id: '2', type: 'radio', text: 'Will you vote in November?', choices: ['Yes', 'No', 'Unsure'], index: 1 }
		]}
		onSave={noop}
	/>
</Story>

<Story name="Empty">
	<BucketSurveyEditorPage
		surveyName="New Survey"
		surveyDescription=""
		bucketName="Swing District Voters"
		questions={[]}
		onSave={noop}
	/>
</Story>
