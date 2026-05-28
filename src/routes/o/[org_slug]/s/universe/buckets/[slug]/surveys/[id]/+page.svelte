<script lang="ts">
	import BucketSurveyEditorPage from '$pages/universe/bucket/bucket-survey-editor-page/BucketSurveyEditorPage.svelte';
	import type { SurveyQuestion } from '$pages/universe/bucket/bucket-survey-editor-page/BucketSurveyEditorPage.svelte';

	const { data } = $props();

	async function handleSave(payload: { name: string; description: string; questions: SurveyQuestion[] }) {
		const orgSlug = data.organization.slug;
		const surveyId = data.survey.id;

		const dbIds = payload.questions.filter((q) => q.db_id !== undefined).map((q) => q.db_id);

		const [r1, r2, r3] = await Promise.all([
			fetch(`/o/${orgSlug}/s/api/surveys/${surveyId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: payload.name, description: payload.description })
			}),
			fetch(`/o/${orgSlug}/s/api/surveys/${surveyId}/questions/purge`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ exclude: dbIds })
			}),
			fetch(`/o/${orgSlug}/s/api/surveys/${surveyId}/questions`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ questions: payload.questions })
			})
		]);

		if (!r1.ok || !r2.ok || !r3.ok) {
			throw new Error('Failed to save survey.');
		}
	}
</script>

<BucketSurveyEditorPage
	surveyName={data.survey.name}
	surveyDescription={data.survey.description ?? ''}
	bucketName={data.bucket.name}
	questions={data.questions}
	onSave={handleSave}
/>
