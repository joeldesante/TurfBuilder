import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { DATABASE_URL: 'postgresql://test:test@localhost/test' }
}));

// Hoisted so the mock factory, which vitest lifts above this file's consts,
// can still reach it.
const { mockClient } = vi.hoisted(() => ({
	mockClient: { query: vi.fn(), release: vi.fn() }
}));

// A function expression, not an arrow: the Pool mock is called with `new`.
vi.mock('pg', () => ({
	Pool: vi.fn(function () {
		return {
			connect: vi.fn().mockResolvedValue(mockClient),
			on: vi.fn(),
			end: vi.fn()
		};
	})
}));

import { GET } from './+server';

// withOrgTransaction rejects anything that is not a UUID.
const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

// The route requires a staff role, then checks can(), which reads the
// permissions hooks.server.ts resolved onto locals.organization.
const authorizedLocals = {
	user: { id: 'u1' },
	organization: { id: ORG, role: { id: 'r1', name: 'Analyst' }, permissions: ['response.read'] }
};

const noPermissionLocals = {
	user: { id: 'u2' },
	organization: { id: ORG, role: { id: 'r2', name: 'Everyone' }, permissions: [] }
};

const noRoleLocals = {
	user: { id: 'u3' },
	organization: { id: ORG, permissions: [] }
};

// Valid RFC 4122 ids: the route's Zod schema rejects ones like 1111...-1111
// whose variant digit is out of range.
const BUCKET_ID = 'b1b2c3d4-e5f6-4890-abcd-ef1234567890';
const SURVEY_ID = 'c1b2c3d4-e5f6-4890-abcd-ef1234567890';

function makeUrl(params: Record<string, string>) {
	const url = new URL('http://localhost/o/test/s/api/universe/metrics/results');
	for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
	return url;
}

/**
 * Returns the given results for the route's queries, in order. The route runs
 * inside withOrgTransaction, whose BEGIN / SET LOCAL / COMMIT / RESET get an
 * empty result without using up the queue.
 */
function queueResults(...results: { rows: unknown[] }[]) {
	const queue = [...results];
	mockClient.query.mockImplementation(async (sql: string) =>
		/^\s*(BEGIN|COMMIT|ROLLBACK|SET LOCAL|RESET)\b/i.test(sql)
			? { rows: [] }
			: (queue.shift() ?? { rows: [] })
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	queueResults();
});

describe('GET /api/universe/metrics/results', () => {
	it('returns 401 when no role is present', async () => {
		const response = await GET({
			locals: noRoleLocals,
			url: makeUrl({ bucketId: BUCKET_ID, surveyId: SURVEY_ID })
		} as any);
		expect(response.status).toBe(401);
	});

	it('returns 403 when caller lacks response:read permission', async () => {
		const response = await GET({
			locals: noPermissionLocals,
			url: makeUrl({ bucketId: BUCKET_ID, surveyId: SURVEY_ID })
		} as any);
		expect(response.status).toBe(403);
	});

	it('returns 400 when bucketId is not a valid UUID', async () => {
		const response = await GET({
			locals: authorizedLocals,
			url: makeUrl({ bucketId: 'not-a-uuid', surveyId: SURVEY_ID })
		} as any);
		expect(response.status).toBe(400);
	});

	it('returns 400 when a date is not in YYYY-MM-DD format', async () => {
		const response = await GET({
			locals: authorizedLocals,
			url: makeUrl({ bucketId: BUCKET_ID, surveyId: SURVEY_ID, startDate: '06/01/2026' })
		} as any);
		expect(response.status).toBe(400);
	});

	it('returns 404 when the bucket does not belong to the organization', async () => {
		queueResults({ rows: [] });

		const response = await GET({
			locals: authorizedLocals,
			url: makeUrl({ bucketId: BUCKET_ID, surveyId: SURVEY_ID })
		} as any);
		expect(response.status).toBe(404);
	});

	it('returns 404 when the survey does not belong to the organization', async () => {
		queueResults({ rows: [{ id: BUCKET_ID }] }, { rows: [] });

		const response = await GET({
			locals: authorizedLocals,
			url: makeUrl({ bucketId: BUCKET_ID, surveyId: SURVEY_ID })
		} as any);
		expect(response.status).toBe(404);
	});

	it('groups responses by location and question', async () => {
		queueResults(
			{ rows: [{ id: BUCKET_ID }] },
			{ rows: [{ id: SURVEY_ID }] },
			{
				rows: [
					{
						location_key: 'public:loc-1',
						name: 'Community Center',
						address_line_1: '100 Main St',
						city: 'Philadelphia',
						latitude: 40.01,
						longitude: -75.1,
						question_id: 'q1',
						question_text: 'Will you vote?',
						question_type: 'single_choice',
						choices: ['Yes', 'No'],
						order_index: 0,
						response_value: 'Yes',
						responded_at: '2026-06-01T12:00:00.000Z',
						responded_by: 'alice'
					},
					{
						location_key: 'public:loc-1',
						name: 'Community Center',
						address_line_1: '100 Main St',
						city: 'Philadelphia',
						latitude: 40.01,
						longitude: -75.1,
						question_id: 'q2',
						question_text: 'Any concerns?',
						question_type: 'text',
						choices: [],
						order_index: 1,
						response_value: null,
						responded_at: '2026-06-01T12:00:00.000Z',
						responded_by: 'alice'
					}
				]
			}
		);

		const response = await GET({
			locals: authorizedLocals,
			url: makeUrl({ bucketId: BUCKET_ID, surveyId: SURVEY_ID })
		} as any);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toHaveLength(1);
		expect(body[0].id).toBe('public:loc-1');
		expect(body[0].questions).toHaveLength(2);
		expect(body[0].questions[0].responses).toEqual([
			{ value: 'Yes', respondedAt: '2026-06-01T12:00:00.000Z', respondedBy: 'alice' }
		]);
		expect(body[0].questions[1].responses).toEqual([]);
	});

	it('skips rows with no coordinates', async () => {
		queueResults(
			{ rows: [{ id: BUCKET_ID }] },
			{ rows: [{ id: SURVEY_ID }] },
			{
				rows: [
					{
						location_key: 'public:loc-2',
						name: 'No Coordinates',
						address_line_1: null,
						city: null,
						latitude: null,
						longitude: null,
						question_id: 'q1',
						question_text: 'Will you vote?',
						question_type: 'single_choice',
						choices: ['Yes', 'No'],
						order_index: 0,
						response_value: 'Yes',
						responded_at: '2026-06-01T12:00:00.000Z',
						responded_by: 'alice'
					}
				]
			}
		);

		const response = await GET({
			locals: authorizedLocals,
			url: makeUrl({ bucketId: BUCKET_ID, surveyId: SURVEY_ID })
		} as any);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toEqual([]);
	});
});
