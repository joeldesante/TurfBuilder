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

const { getSurvey, replaceSurvey, updateSurvey, deleteSurvey } = vi.hoisted(() => ({
	getSurvey: vi.fn(),
	replaceSurvey: vi.fn(),
	updateSurvey: vi.fn(),
	deleteSurvey: vi.fn()
}));

vi.mock('$lib/server/services/surveys.service', () => ({
	getSurvey,
	replaceSurvey,
	updateSurvey,
	deleteSurvey
}));

import { GET, PUT, PATCH, DELETE } from './+server';

const SURVEY = 'b1b2c3d4-e5f6-7890-abcd-ef1234567890';
const params = { survey_id: SURVEY };
const signedIn = { user: { id: 'u1' } };

function withBody(handler: typeof PUT, body: unknown, locals: unknown = signedIn) {
	return handler({
		params,
		locals,
		request: new Request('http://localhost/api/v1/surveys/x', {
			method: 'PUT',
			body: JSON.stringify(body)
		})
	} as never);
}

beforeEach(() => vi.clearAllMocks());

describe('GET /api/v1/surveys/[survey_id]', () => {
	it('answers 401 when signed out', async () => {
		await expect(GET({ params, locals: {} } as never)).rejects.toMatchObject({ status: 401 });
	});

	it('answers 400 for a malformed id', async () => {
		await expect(
			GET({ params: { survey_id: 'nope' }, locals: signedIn } as never)
		).rejects.toMatchObject({ status: 400 });
	});

	it("returns the service's survey", async () => {
		getSurvey.mockResolvedValue({ id: SURVEY });

		const res = await GET({ params, locals: signedIn } as never);

		expect(await res.json()).toEqual({ id: SURVEY });
		expect(getSurvey).toHaveBeenCalledWith('u1', SURVEY);
	});
});

describe('PUT /api/v1/surveys/[survey_id]', () => {
	it('answers 401 when signed out', async () => {
		await expect(withBody(PUT, { name: 'A' }, {})).rejects.toMatchObject({ status: 401 });
	});

	it('answers 400 when the name is blank', async () => {
		await expect(withBody(PUT, { name: '  ' })).rejects.toMatchObject({ status: 400 });
	});

	it('replaces the survey with the body', async () => {
		replaceSurvey.mockResolvedValue({ id: SURVEY });

		await withBody(PUT, { name: 'Spring', description: 'Notes' });

		expect(replaceSurvey).toHaveBeenCalledWith('u1', SURVEY, { name: 'Spring', description: 'Notes' });
	});
});

describe('PATCH /api/v1/surveys/[survey_id]', () => {
	it('answers 400 for a description that is too long', async () => {
		await expect(withBody(PATCH, { description: 'x'.repeat(2001) })).rejects.toMatchObject({
			status: 400
		});
	});

	it('updates only the given fields', async () => {
		updateSurvey.mockResolvedValue({ id: SURVEY });

		await withBody(PATCH, { description: null });

		expect(updateSurvey).toHaveBeenCalledWith('u1', SURVEY, { description: null });
	});
});

describe('DELETE /api/v1/surveys/[survey_id]', () => {
	it('answers 401 when signed out', async () => {
		await expect(DELETE({ params, locals: {} } as never)).rejects.toMatchObject({ status: 401 });
	});

	it('answers 204 after deleting', async () => {
		const res = await DELETE({ params, locals: signedIn } as never);

		expect(res.status).toBe(204);
		expect(deleteSurvey).toHaveBeenCalledWith('u1', SURVEY);
	});

	it('passes a conflict through', async () => {
		deleteSurvey.mockRejectedValue({ status: 409 });

		await expect(DELETE({ params, locals: signedIn } as never)).rejects.toMatchObject({
			status: 409
		});
	});
});
