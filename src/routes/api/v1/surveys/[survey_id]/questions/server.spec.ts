import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { DATABASE_URL: 'postgresql://test:test@localhost/test' }
}));

// A function expression, not an arrow: the Pool mock is called with `new`.
vi.mock('pg', () => ({
	Pool: vi.fn(function () {
		return { query: vi.fn(), connect: vi.fn(), on: vi.fn(), end: vi.fn() };
	})
}));

const { listSurveyQuestions, replaceSurveyQuestions } = vi.hoisted(() => ({
	listSurveyQuestions: vi.fn(),
	replaceSurveyQuestions: vi.fn()
}));

vi.mock('$lib/server/services/surveys.service', () => ({
	listSurveyQuestions,
	replaceSurveyQuestions
}));

import { GET, PUT } from './+server';

const SURVEY = 'b1b2c3d4-e5f6-7890-abcd-ef1234567890';
const params = { survey_id: SURVEY };
const signedIn = { user: { id: 'u1' } };

function put(body: unknown, locals: unknown = signedIn) {
	return PUT({
		params,
		locals,
		request: new Request('http://localhost/api/v1/surveys/x/questions', {
			method: 'PUT',
			body: JSON.stringify(body)
		})
	} as never);
}

beforeEach(() => vi.clearAllMocks());

describe('GET /api/v1/surveys/[survey_id]/questions', () => {
	it('answers 401 when signed out', async () => {
		await expect(GET({ params, locals: {} } as never)).rejects.toMatchObject({ status: 401 });
	});

	it('answers 400 for a malformed id', async () => {
		await expect(
			GET({ params: { survey_id: 'nope' }, locals: signedIn } as never)
		).rejects.toMatchObject({ status: 400 });
	});

	it('returns what the service finds', async () => {
		listSurveyQuestions.mockResolvedValue([{ id: 'q1' }]);

		const res = await GET({ params, locals: signedIn } as never);

		expect(await res.json()).toEqual([{ id: 'q1' }]);
		expect(listSurveyQuestions).toHaveBeenCalledWith('u1', SURVEY);
	});
});

describe('PUT /api/v1/surveys/[survey_id]/questions', () => {
	const valid = [
		{ question_text: 'Vote?', question_type: 'radio', choices: ['Yes', 'No'] },
		{ id: SURVEY, question_text: 'Why?', question_type: 'text', choices: [] }
	];

	it('answers 401 when signed out', async () => {
		await expect(put(valid, {})).rejects.toMatchObject({ status: 401 });
	});

	it('answers 400 for an unknown question type', async () => {
		await expect(
			put([{ question_text: 'Vote?', question_type: 'dial', choices: [] }])
		).rejects.toMatchObject({ status: 400 });
	});

	it('answers 400 when the body is not an array', async () => {
		await expect(put({ questions: [] })).rejects.toMatchObject({ status: 400 });
	});

	it('replaces the questions with the array sent', async () => {
		replaceSurveyQuestions.mockResolvedValue([{ id: 'q1' }]);

		const res = await put(valid);

		expect(await res.json()).toEqual([{ id: 'q1' }]);
		expect(replaceSurveyQuestions).toHaveBeenCalledWith('u1', SURVEY, valid);
	});

	it('accepts an empty array to remove every question', async () => {
		replaceSurveyQuestions.mockResolvedValue([]);

		await put([]);

		expect(replaceSurveyQuestions).toHaveBeenCalledWith('u1', SURVEY, []);
	});
});
