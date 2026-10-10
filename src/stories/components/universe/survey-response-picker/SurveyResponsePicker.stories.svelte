<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import SurveyResponsePicker from './SurveyResponsePicker.svelte';
	import type { SurveyFilterSource } from '$lib/client/survey-filter-source';

	const source: SurveyFilterSource = {
		listBuckets: async () => [{ id: 'b1', name: 'Philadelphia voters' }],
		listSurveys: async () => [{ id: 's1', name: 'Spring canvass' }],
		listQuestions: async () => [
			{
				id: 'q1',
				question_text: 'Will you vote for the measure?',
				question_type: 'radio',
				choices: ['Yes', 'No', 'Undecided']
			},
			{ id: 'q2', question_text: 'What is your top concern?', question_type: 'text', choices: [] }
		]
	};

	const { Story } = defineMeta({
		title: 'Components/Universe/SurveyResponsePicker',
		component: SurveyResponsePicker,
		args: { source, value: null, onchange: () => {} }
	});
</script>

<Story name="Empty" />
<Story
	name="Choice Question"
	args={{ value: { bucketId: 'b1', surveyId: 's1', questionId: 'q1', response: 'Yes' } }}
/>
<Story
	name="Text Question"
	args={{ value: { bucketId: 'b1', surveyId: 's1', questionId: 'q2', response: 'Housing' } }}
/>
