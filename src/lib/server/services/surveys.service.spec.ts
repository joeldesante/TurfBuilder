import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { DATABASE_URL: 'postgresql://test:test@localhost/test' }
}));

const { mockClient, canOrg } = vi.hoisted(() => ({
	mockClient: { query: vi.fn(), release: vi.fn() },
	canOrg: vi.fn()
}));

// A function expression, not an arrow: the Pool mock is called with `new`.
vi.mock('pg', () => ({
	Pool: vi.fn(function () {
		return {
			query: mockClient.query,
			connect: vi.fn().mockResolvedValue(mockClient),
			on: vi.fn(),
			end: vi.fn()
		};
	})
}));

vi.mock('$lib/server/permissions', () => ({ canOrg }));

const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const BUCKET = 'b1b2c3d4-e5f6-7890-abcd-ef1234567890';
const SURVEY = 'c1b2c3d4-e5f6-7890-abcd-ef1234567890';
const found = { rowCount: 1, rows: [{ id: SURVEY }] };

import {
	listBucketSurveys,
	listSurveyQuestions,
	createSurvey,
	getSurvey,
	replaceSurvey,
	updateSurvey,
	deleteSurvey,
	replaceSurveyQuestions
} from './surveys.service';

/** Answers membership and the bucket and survey lookups, and everything else with `rest`. */
function stub(rest: (sql: string, values?: unknown[]) => unknown = () => found) {
	mockClient.query.mockImplementation((sql: string, values?: unknown[]) => {
		if (sql.includes('FROM auth.member')) {
			return Promise.resolve({ rowCount: 1, rows: [{ organization_id: ORG }] });
		}
		if (sql.includes('SELECT 1 FROM universe.bucket')) return Promise.resolve(found);
		if (sql.includes('SELECT 1 FROM universe.survey WHERE')) return Promise.resolve(found);
		return Promise.resolve(rest(sql, values));
	});
}

function sqlRun(fragment: string) {
	return mockClient.query.mock.calls.find((c) => String(c[0]).includes(fragment));
}

beforeEach(() => {
	vi.clearAllMocks();
	canOrg.mockResolvedValue(true);
	stub();
});

describe('every operation', () => {
	it.each([
		['listBucketSurveys', () => listBucketSurveys('u1', BUCKET)],
		['listSurveyQuestions', () => listSurveyQuestions('u1', SURVEY)],
		['createSurvey', () => createSurvey('u1', BUCKET, { name: 'A' })],
		['getSurvey', () => getSurvey('u1', SURVEY)],
		['replaceSurvey', () => replaceSurvey('u1', SURVEY, { name: 'A' })],
		['updateSurvey', () => updateSurvey('u1', SURVEY, { name: 'A' })],
		['deleteSurvey', () => deleteSurvey('u1', SURVEY)],
		['replaceSurveyQuestions', () => replaceSurveyQuestions('u1', SURVEY, [])]
	])('%s answers 403 without staff access and changes nothing', async (_name, run) => {
		canOrg.mockResolvedValue(false);

		await expect(run()).rejects.toMatchObject({ status: 403 });

		const sql = mockClient.query.mock.calls.map((c) => String(c[0])).join('\n');
		expect(sql).not.toMatch(/INSERT INTO universe|UPDATE universe|DELETE FROM universe/);
	});

	it.each([
		['listBucketSurveys', () => listBucketSurveys('u1', BUCKET)],
		['createSurvey', () => createSurvey('u1', BUCKET, { name: 'A' })]
	])('%s answers 404 for a bucket in none of the user\'s orgs', async (_name, run) => {
		mockClient.query.mockImplementation((sql: string) =>
			Promise.resolve(
				sql.includes('FROM auth.member')
					? { rowCount: 1, rows: [{ organization_id: ORG }] }
					: { rowCount: 0, rows: [] }
			)
		);

		await expect(run()).rejects.toMatchObject({ status: 404 });
	});
});

describe('createSurvey', () => {
	it('inserts into the bucket and org with a null description by default', async () => {
		await createSurvey('u1', BUCKET, { name: 'Spring' });

		expect(sqlRun('INSERT INTO universe.survey')![1]).toEqual(['Spring', null, BUCKET, ORG]);
	});
});

describe('getSurvey', () => {
	it('answers 404 when the row is gone', async () => {
		stub((sql) => (sql.includes('SELECT id, bucket_id') ? { rowCount: 0, rows: [] } : found));

		await expect(getSurvey('u1', SURVEY)).rejects.toMatchObject({ status: 404 });
	});
});

describe('replaceSurvey and updateSurvey', () => {
	it('replace clears an omitted description', async () => {
		await replaceSurvey('u1', SURVEY, { name: 'A' });

		expect(sqlRun('UPDATE universe.survey')![1]).toEqual([SURVEY, ORG, 'A', true, null]);
	});

	it('update leaves the description alone when it is not given', async () => {
		await updateSurvey('u1', SURVEY, { name: 'A' });

		expect(sqlRun('UPDATE universe.survey')![1]).toEqual([SURVEY, ORG, 'A', false, null]);
	});

	it('update clears the description when given null', async () => {
		await updateSurvey('u1', SURVEY, { description: null });

		expect(sqlRun('UPDATE universe.survey')![1]).toEqual([SURVEY, ORG, null, true, null]);
	});
});

describe('deleteSurvey', () => {
	it('answers 409 while a turf uses the survey, without deleting', async () => {
		stub((sql) => (sql.includes('FROM universe.turf') ? found : { rowCount: 1, rows: [] }));

		await expect(deleteSurvey('u1', SURVEY)).rejects.toMatchObject({ status: 409 });
		expect(sqlRun('DELETE FROM universe.survey ')).toBeUndefined();
	});

	it('deletes an unused survey within its org', async () => {
		stub((sql) => (sql.includes('FROM universe.turf') ? { rowCount: 0, rows: [] } : found));

		await deleteSurvey('u1', SURVEY);

		expect(sqlRun('DELETE FROM universe.survey ')![1]).toEqual([SURVEY, ORG]);
	});
});

describe('replaceSurveyQuestions', () => {
	const existing = 'd1b2c3d4-e5f6-7890-abcd-ef1234567890';
	const questions = [
		{ question_text: 'New', question_type: 'text' as const, choices: [] },
		{ id: existing, question_text: 'Kept', question_type: 'radio' as const, choices: ['A', 'B'] }
	];

	it('deletes the questions not listed, scoped to the survey and org', async () => {
		await replaceSurveyQuestions('u1', SURVEY, questions);

		expect(sqlRun('DELETE FROM universe.survey_question')![1]).toEqual([SURVEY, ORG, [existing]]);
	});

	it('creates and updates by position', async () => {
		await replaceSurveyQuestions('u1', SURVEY, questions);

		expect(sqlRun('INSERT INTO universe.survey_question')![1]).toEqual([
			'New',
			'text',
			0,
			[],
			SURVEY,
			ORG
		]);
		expect(sqlRun('UPDATE universe.survey_question')![1]).toEqual([
			'Kept',
			'radio',
			1,
			['A', 'B'],
			existing,
			SURVEY,
			ORG
		]);
	});

	it('answers 400 when an id is not one of the survey\'s questions', async () => {
		stub((sql) => (sql.includes('UPDATE universe.survey_question') ? { rowCount: 0, rows: [] } : found));

		await expect(replaceSurveyQuestions('u1', SURVEY, questions)).rejects.toMatchObject({
			status: 400
		});
	});
});
