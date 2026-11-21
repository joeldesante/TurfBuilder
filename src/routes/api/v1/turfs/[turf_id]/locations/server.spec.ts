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
	suggestLocation: vi.fn()
}));

vi.mock('$lib/server/services/canvass.service', () => mocks);

import { POST } from './+server';

const params = { turf_id: 'c1b2c3d4-e5f6-7890-abcd-ef1234567890' };
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
		request = new Request('http://localhost/api/v1/turfs/[turf_id]/locations', {
			method: 'POST',
			body: form
		});
	} else {
		request = new Request(
			'http://localhost/api/v1/turfs/[turf_id]/locations' + (query ? `?${query}` : ''),
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
	mocks.suggestLocation.mockResolvedValue({ ok: true });
});

describe('POST /api/v1/turfs/[turf_id]/locations', () => {
	it('answers 401 when signed out', async () => {
		await expect(
			call(POST, { locals: {}, body: { name: 'Deli', latitude: 39.95, longitude: -75.16 } })
		).rejects.toMatchObject({ status: 401 });
		expect(mocks.suggestLocation).not.toHaveBeenCalled();
	});

	it('answers 400 for a malformed id', async () => {
		await expect(
			call(POST, {
				routeParams: { ...params, turf_id: 'nope' },
				body: { name: 'Deli', latitude: 39.95, longitude: -75.16 }
			})
		).rejects.toMatchObject({ status: 400 });
		expect(mocks.suggestLocation).not.toHaveBeenCalled();
	});

	it('asks the service as the caller and answers 201', async () => {
		const res = await call(POST, { body: { name: 'Deli', latitude: 39.95, longitude: -75.16 } });

		expect(res.status).toBe(201);
		expect(mocks.suggestLocation).toHaveBeenCalledWith(
			'u1',
			'c1b2c3d4-e5f6-7890-abcd-ef1234567890',
			expect.objectContaining({ name: 'Deli' })
		);
	});

	it('answers 400 for a body that is not JSON', async () => {
		const request = new Request('http://localhost/api/v1/turfs/[turf_id]/locations', {
			method: 'POST',
			body: 'not json'
		});
		await expect(
			POST({ params, locals: signedIn, request, url: new URL(request.url) } as never)
		).rejects.toMatchObject({ status: 400 });
	});
});
