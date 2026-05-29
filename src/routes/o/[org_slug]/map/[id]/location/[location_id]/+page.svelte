<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import SurveyScreen from '$pages/survey/SurveyScreen.svelte';

	const { data } = $props();

	const orgSlug = $page.params.org_slug;

	type ContactStatus = 'no_contact' | 'contacted' | null;

	function toContactStatus(v: boolean | null): ContactStatus {
		if (v === true) return 'contacted';
		if (v === false) return 'no_contact';
		return null;
	}

	let contactStatus = $state<ContactStatus>(toContactStatus(data.existingContactMade));
	let attemptNote = $state(data.existingAttemptNote ?? '');
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
		if (!contactStatus) return;
		loading = true;
		try {
			const r = await fetch($page.url.pathname, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ contactStatus, attemptNote, questions })
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
	scriptContent={data.scriptContents}
	bind:contactStatus
	bind:questions
	bind:attemptNote
	{backHref}
	{loading}
	onSubmit={handleSubmit}
/>
