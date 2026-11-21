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

const mocks = vi.hoisted(() => ({
	rejectSuggestion: vi.fn()
}));

vi.mock('$lib/server/services/suggestions.service', () => mocks);

import { DELETE } from './+server';

const params = { suggestion_id: 'c1b2c3d4-e5f6-7890-abcd-ef1234567890' };
const signedIn = { user: { id: 'u1' } };

function call(
	handler: (event: never) => Response | Promise<Response>,
	{
		locals = signedIn as unknown,
		routeParams = params as Record<string, string>,
		body,
		query = '',
		file
	}: {
		locals?: unknown;
		routeParams?: Record<string, string>;
		body?: unknown;
		query?: string;
		file?: string;
	} = {}
) {
	let request: Request;
	if (file !== undefined) {
		const form = new FormData();
		form.set('file', new File([file], 'locations.csv', { type: 'text/csv' }));
		request = new Request('http://localhost/api/v1/location-suggestions/[suggestion_id]', {
			method: 'POST',
			body: form
		});
	} else {
		request = new Request(
			'http://localhost/api/v1/location-suggestions/[suggestion_id]' + (query ? `?${query}` : ''),
			{
				method: body === undefined ? 'GET' : 'POST',
				body: body === undefined ? undefined : JSON.stringify(body)
			}
		);
	}
	return handler({ params: routeParams, locals, request, url: new URL(request.url) } as never);
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.rejectSuggestion.mockResolvedValue({ ok: true });
});

describe('DELETE /api/v1/location-suggestions/[suggestion_id]', () => {
	it('answers 401 when signed out', async () => {
		await expect(call(DELETE, { locals: {} })).rejects.toMatchObject({ status: 401 });
		expect(mocks.rejectSuggestion).not.toHaveBeenCalled();
	});

	it('answers 400 for a malformed id', async () => {
		await expect(
			call(DELETE, { routeParams: { ...params, suggestion_id: 'nope' } })
		).rejects.toMatchObject({ status: 400 });
		expect(mocks.rejectSuggestion).not.toHaveBeenCalled();
	});

	it('asks the service as the caller and answers 204', async () => {
		const res = await call(DELETE);

		expect(res.status).toBe(204);
		expect(mocks.rejectSuggestion).toHaveBeenCalledWith(
			'u1',
			'c1b2c3d4-e5f6-7890-abcd-ef1234567890'
		);
	});
});
