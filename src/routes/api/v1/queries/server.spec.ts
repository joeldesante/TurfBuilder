import { describe, it, expect, vi, beforeEach } from 'vitest';
import { error } from '@sveltejs/kit';

vi.mock('$env/dynamic/private', () => ({
	env: { DATABASE_URL: 'postgresql://test:test@localhost/test' }
}));

// A function expression, not an arrow: the Pool mock is called with `new`.
vi.mock('pg', () => ({
	Pool: vi.fn(function () {
		return { query: vi.fn(), connect: vi.fn(), on: vi.fn(), end: vi.fn() };
	})
}));

const { runQueries, QueryError } = vi.hoisted(() => ({
	runQueries: vi.fn(),
	QueryError: class QueryError extends Error {}
}));

vi.mock('$lib/server/services/query-builder.service', () => ({ runQueries, QueryError }));

import { POST } from './+server';

const signedIn = { user: { id: 'u1' } };
const body = { queries: [{ select: ['code'], from: 'universe.turf' }] };

function post(payload: unknown, locals: unknown = signedIn) {
	const request = new Request('http://localhost/api/v1/queries', {
		method: 'POST',
		body: typeof payload === 'string' ? payload : JSON.stringify(payload)
	});
	return POST({ locals, request } as never);
}

beforeEach(() => vi.clearAllMocks());

describe('POST /api/v1/queries', () => {
	it('answers 401 when signed out', async () => {
		await expect(post(body, {})).rejects.toMatchObject({ status: 401 });
		expect(runQueries).not.toHaveBeenCalled();
	});

	it('answers 400 for a body that is not JSON', async () => {
		await expect(post('not json')).rejects.toMatchObject({ status: 400 });
	});

	it('runs the queries as the caller and returns field names and rows', async () => {
		runQueries.mockResolvedValue([{ fields: [{ name: 'code' }], rows: [{ code: 'ABC123' }] }]);

		const res = await post(body);

		expect(runQueries).toHaveBeenCalledWith('u1', body);
		expect(await res.json()).toEqual({
			results: [{ fields: ['code'], rows: [{ code: 'ABC123' }] }]
		});
	});

	it('answers 400 for a query the builder refuses', async () => {
		runQueries.mockRejectedValue(new QueryError('Unknown table.'));

		await expect(post(body)).rejects.toMatchObject({
			status: 400,
			body: { message: 'Unknown table.' }
		});
	});

	it('passes a refusal of access through', async () => {
		runQueries.mockImplementation(async () => {
			throw error(403, 'Forbidden');
		});

		await expect(post(body)).rejects.toMatchObject({ status: 403 });
	});
});
