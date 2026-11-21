<script lang="ts">
	import BucketSurveyEditorPage from '$pages/o/s/universe/buckets/surveys/BucketSurveyEditorPage.svelte';
	import type { SurveyQuestion } from '$pages/o/s/universe/buckets/surveys/BucketSurveyEditorPage.svelte';
	import { api } from '$lib/client/api';

	const { data } = $props();

	async function handleSave(payload: {
		name: string;
		description: string;
		questions: SurveyQuestion[];
	}) {
		const surveyId = data.survey.id;

		// The questions PUT replaces the whole set: questions with an id are kept
		// and updated, new ones are created, and any left out are deleted.
		await Promise.all([
			api(`/surveys/${surveyId}`, {
				method: 'PUT',
				body: { name: payload.name, description: payload.description || null }
			}),
			api(`/surveys/${surveyId}/questions`, {
				method: 'PUT',
				body: payload.questions.map((q) => ({
					id: q.db_id,
					question_text: q.text,
					question_type: q.type,
					choices: q.choices
				}))
			})
		]);
	}
</script>

<BucketSurveyEditorPage
	surveyName={data.survey.name}
	surveyDescription={data.survey.description ?? ''}
	bucketName={data.bucket.name}
	questions={data.questions}
	onSave={handleSave}
/>
