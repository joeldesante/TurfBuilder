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
	createListTurfs: vi.fn(),
	listListTurfs: vi.fn()
}));

vi.mock('$lib/server/services/turfs.service', async (original) => {
	const actual = await original<Record<string, unknown>>();
	return { CreateTurfsSchema: actual.CreateTurfsSchema, ...mocks };
});

import { GET, POST } from './+server';

const params = { list_id: 'c1b2c3d4-e5f6-7890-abcd-ef1234567890' };
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
		request = new Request('http://localhost/api/v1/lists/[list_id]/turfs', {
			method: 'POST',
			body: form
		});
	} else {
		request = new Request(
			'http://localhost/api/v1/lists/[list_id]/turfs' + (query ? `?${query}` : ''),
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
	mocks.createListTurfs.mockResolvedValue({ ok: true });
	mocks.listListTurfs.mockResolvedValue({ ok: true });
});

describe('POST /api/v1/lists/[list_id]/turfs', () => {
	it('answers 401 when signed out', async () => {
		await expect(
			call(POST, {
				locals: {},
				body: {
					polygons: [{ geometry: { type: 'Polygon', coordinates: [] } }],
					survey_id: 'd1b2c3d4-e5f6-7890-abcd-ef1234567890'
				}
			})
		).rejects.toMatchObject({ status: 401 });
		expect(mocks.createListTurfs).not.toHaveBeenCalled();
	});

	it('answers 400 for a malformed id', async () => {
		await expect(
			call(POST, {
				routeParams: { ...params, list_id: 'nope' },
				body: {
					polygons: [{ geometry: { type: 'Polygon', coordinates: [] } }],
					survey_id: 'd1b2c3d4-e5f6-7890-abcd-ef1234567890'
				}
			})
		).rejects.toMatchObject({ status: 400 });
		expect(mocks.createListTurfs).not.toHaveBeenCalled();
	});

	it('asks the service as the caller and answers 201', async () => {
		const res = await call(POST, {
			body: {
				polygons: [{ geometry: { type: 'Polygon', coordinates: [] } }],
				survey_id: 'd1b2c3d4-e5f6-7890-abcd-ef1234567890'
			}
		});

		expect(res.status).toBe(201);
		expect(mocks.createListTurfs).toHaveBeenCalledWith(
			'u1',
			'c1b2c3d4-e5f6-7890-abcd-ef1234567890',
			expect.objectContaining({ survey_id: 'd1b2c3d4-e5f6-7890-abcd-ef1234567890' })
		);
	});

	it('answers 400 for a body that is not JSON', async () => {
		const request = new Request('http://localhost/api/v1/lists/[list_id]/turfs', {
			method: 'POST',
			body: 'not json'
		});
		await expect(
			POST({ params, locals: signedIn, request, url: new URL(request.url) } as never)
		).rejects.toMatchObject({ status: 400 });
	});
});

describe('GET /api/v1/lists/[list_id]/turfs', () => {
	it('answers 401 when signed out', async () => {
		await expect(call(GET, { locals: {} })).rejects.toMatchObject({ status: 401 });
		expect(mocks.listListTurfs).not.toHaveBeenCalled();
	});

	it('answers 400 for a malformed id', async () => {
		await expect(call(GET, { routeParams: { ...params, list_id: 'nope' } })).rejects.toMatchObject({
			status: 400
		});
		expect(mocks.listListTurfs).not.toHaveBeenCalled();
	});

	it('asks the service as the caller and answers 200', async () => {
		const res = await call(GET);

		expect(res.status).toBe(200);
		expect(mocks.listListTurfs).toHaveBeenCalledWith('u1', 'c1b2c3d4-e5f6-7890-abcd-ef1234567890');
		expect(await res.json()).toEqual({ ok: true });
	});
});
