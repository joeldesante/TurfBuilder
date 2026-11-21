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
	getTurfPreview: vi.fn()
}));

vi.mock('$lib/server/services/turfs.service', () => mocks);

import { GET } from './+server';

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
		request = new Request('http://localhost/api/v1/turfs/[turf_id]', {
			method: 'POST',
			body: form
		});
	} else {
		request = new Request('http://localhost/api/v1/turfs/[turf_id]' + (query ? `?${query}` : ''), {
			method: body === undefined ? 'GET' : 'POST',
			body: body === undefined ? undefined : JSON.stringify(body)
		});
	}
	return handler({ params: routeParams, locals, request, url: new URL(request.url) } as never);
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.getTurfPreview.mockResolvedValue({ ok: true });
});

describe('GET /api/v1/turfs/[turf_id]', () => {
	it('answers 401 when signed out', async () => {
		await expect(call(GET, { locals: {} })).rejects.toMatchObject({ status: 401 });
		expect(mocks.getTurfPreview).not.toHaveBeenCalled();
	});

	it('answers 400 for a malformed id', async () => {
		await expect(call(GET, { routeParams: { ...params, turf_id: 'nope' } })).rejects.toMatchObject({
			status: 400
		});
		expect(mocks.getTurfPreview).not.toHaveBeenCalled();
	});

	it('asks the service as the caller and answers 200', async () => {
		const res = await call(GET);

		expect(res.status).toBe(200);
		expect(mocks.getTurfPreview).toHaveBeenCalledWith('u1', 'c1b2c3d4-e5f6-7890-abcd-ef1234567890');
		expect(await res.json()).toEqual({ ok: true });
	});
});
