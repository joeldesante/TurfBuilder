import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';
import SurveyResponsePicker from './SurveyResponsePicker.svelte';
import type { FilterSource } from '$lib/client/filter-source';

function makeSource(overrides: Partial<FilterSource> = {}): FilterSource {
	return {
		listBuckets: async () => [{ id: 'b1', name: 'Voters' }],
		listLists: async () => [],
		listSurveys: async () => [{ id: 's1', name: 'Spring canvass' }],
		listQuestions: async () => [
			{ id: 'q1', question_text: 'Vote for the measure?', question_type: 'radio', choices: ['Yes', 'No'] },
			{ id: 'q2', question_text: 'Top concern?', question_type: 'text', choices: [] }
		],
		...overrides
	};
}

const chosen = { bucketId: 'b1', surveyId: 's1', questionId: 'q1', response: '' };

test('starts with only the bucket choice', async () => {
	const { getByRole } = render(SurveyResponsePicker, {
		props: { source: makeSource(), value: null, onchange: () => {} }
	});

	await expect.element(getByRole('button', { name: 'Bucket' })).toBeVisible();
	await expect.element(getByRole('button', { name: 'Survey' })).not.toBeInTheDocument();
});

test('picking a bucket reports it and clears what was below it', async () => {
	const onchange = vi.fn();
	const { getByRole } = render(SurveyResponsePicker, {
		props: { source: makeSource(), value: null, onchange }
	});

	await getByRole('button', { name: 'Bucket' }).click();
	await getByRole('option', { name: 'Voters' }).click();

	expect(onchange).toHaveBeenCalledWith({ bucketId: 'b1', surveyId: '', questionId: '', response: '' });
});

test('offers the surveys of the chosen bucket', async () => {
	const listSurveys = vi.fn(async () => [{ id: 's1', name: 'Spring canvass' }]);
	const { getByRole } = render(SurveyResponsePicker, {
		props: {
			source: makeSource({ listSurveys }),
			value: { ...chosen, surveyId: '', questionId: '' },
			onchange: () => {}
		}
	});

	await getByRole('button', { name: 'Survey' }).click();

	await expect.element(getByRole('option', { name: 'Spring canvass' })).toBeVisible();
	expect(listSurveys).toHaveBeenCalledWith('b1');
});

test('offers the choices of a multiple choice question', async () => {
	const onchange = vi.fn();
	const { getByRole } = render(SurveyResponsePicker, {
		props: { source: makeSource(), value: chosen, onchange }
	});

	await getByRole('button', { name: 'Response' }).click();
	await getByRole('option', { name: 'No' }).click();

	expect(onchange).toHaveBeenCalledWith({ ...chosen, response: 'No' });
});

test('takes typed text for a question without choices', async () => {
	const onchange = vi.fn();
	const { getByRole } = render(SurveyResponsePicker, {
		props: { source: makeSource(), value: { ...chosen, questionId: 'q2' }, onchange }
	});

	await getByRole('textbox', { name: 'Response' }).fill('Housing');

	expect(onchange).toHaveBeenLastCalledWith({ ...chosen, questionId: 'q2', response: 'Housing' });
});

test('says so when the choices cannot be loaded', async () => {
	const { getByText } = render(SurveyResponsePicker, {
		props: {
			source: makeSource({ listBuckets: async () => Promise.reject(new Error('boom')) }),
			value: null,
			onchange: () => {}
		}
	});

	await expect.element(getByText('The survey choices could not be loaded.')).toBeVisible();
});
