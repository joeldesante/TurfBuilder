<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import SurveyScreen from '$pages/survey/SurveyScreen.svelte';

	const { data } = $props();

	const orgSlug = $page.params.org_slug;

	let contactMade = $state(data.locationAttempt.contact_made ?? false);
	let attemptNote = $state(data.locationAttempt.attempt_note ?? '');
	let loading = $state(false);

	interface ServerQuestion {
		id: string;
		question_type: string;
		question_text: string;
		choices: string[];
		order_index: string;
	}

	interface ServerResponse {
		survey_question_id: string;
		response_value: string;
	}

	let backHref = `/o/${orgSlug}/map/${data.turfId}`;

	type QuestionType = 'radio' | 'check' | 'text';

	let questions = $state(
		data.questions.map((q: ServerQuestion) => ({
			db_id: q.id,
			type: q.question_type as QuestionType,
			text: q.question_text,
			choices: q.choices,
			index: parseInt(q.order_index),
			response:
				data.responses.find((r: ServerResponse) => r.survey_question_id === q.id)?.response_value ||
				''
		}))
	);

	async function handleSubmit() {
		loading = true;
		try {
			const r = await fetch(`/api/surveys/${data.surveyId}/attempts/${data.locationAttempt.id}/`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ turf_id: data.turfId, contactMade, attemptNote, questions })
			});

			if (!r.ok) throw new Error('Failed to save.');

			goto(`/o/${orgSlug}/map/${data.turfId}`);
		} catch (e) {
			loading = false;
			throw e;
		}
	}
</script>

<SurveyScreen
	location={data.location}
	bind:questions
	bind:contactMade
	bind:attemptNote
	{backHref}
	{loading}
	onSubmit={handleSubmit}
/>
