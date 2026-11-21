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
	updateSuggestedLocation: vi.fn(),
	withdrawSuggestedLocation: vi.fn()
}));

vi.mock('$lib/server/services/canvass.service', () => mocks);

import { DELETE, PATCH } from './+server';

const params = {
	turf_id: 'c1b2c3d4-e5f6-7890-abcd-ef1234567890',
	entity_id: 'd1b2c3d4-e5f6-7890-abcd-ef1234567890'
};
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
		request = new Request('http://localhost/api/v1/turfs/[turf_id]/locations/[entity_id]', {
			method: 'POST',
			body: form
		});
	} else {
		request = new Request(
			'http://localhost/api/v1/turfs/[turf_id]/locations/[entity_id]' + (query ? `?${query}` : ''),
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
	mocks.updateSuggestedLocation.mockResolvedValue({ ok: true });
	mocks.withdrawSuggestedLocation.mockResolvedValue({ ok: true });
});

describe('PATCH /api/v1/turfs/[turf_id]/locations/[entity_id]', () => {
	it('answers 401 when signed out', async () => {
		await expect(call(PATCH, { locals: {}, body: { name: 'Deli 2' } })).rejects.toMatchObject({
			status: 401
		});
		expect(mocks.updateSuggestedLocation).not.toHaveBeenCalled();
	});

	it('answers 400 for a malformed id', async () => {
		await expect(
			call(PATCH, { routeParams: { ...params, entity_id: 'nope' }, body: { name: 'Deli 2' } })
		).rejects.toMatchObject({ status: 400 });
		expect(mocks.updateSuggestedLocation).not.toHaveBeenCalled();
	});

	it('asks the service as the caller and answers 200', async () => {
		const res = await call(PATCH, { body: { name: 'Deli 2' } });

		expect(res.status).toBe(200);
		expect(mocks.updateSuggestedLocation).toHaveBeenCalledWith(
			'u1',
			'c1b2c3d4-e5f6-7890-abcd-ef1234567890',
			'd1b2c3d4-e5f6-7890-abcd-ef1234567890',
			{ name: 'Deli 2' }
		);
		expect(await res.json()).toEqual({ ok: true });
	});

	it('answers 400 for a body that is not JSON', async () => {
		const request = new Request('http://localhost/api/v1/turfs/[turf_id]/locations/[entity_id]', {
			method: 'POST',
			body: 'not json'
		});
		await expect(
			PATCH({ params, locals: signedIn, request, url: new URL(request.url) } as never)
		).rejects.toMatchObject({ status: 400 });
	});
});

describe('DELETE /api/v1/turfs/[turf_id]/locations/[entity_id]', () => {
	it('answers 401 when signed out', async () => {
		await expect(call(DELETE, { locals: {} })).rejects.toMatchObject({ status: 401 });
		expect(mocks.withdrawSuggestedLocation).not.toHaveBeenCalled();
	});

	it('answers 400 for a malformed id', async () => {
		await expect(
			call(DELETE, { routeParams: { ...params, entity_id: 'nope' } })
		).rejects.toMatchObject({ status: 400 });
		expect(mocks.withdrawSuggestedLocation).not.toHaveBeenCalled();
	});

	it('asks the service as the caller and answers 204', async () => {
		const res = await call(DELETE);

		expect(res.status).toBe(204);
		expect(mocks.withdrawSuggestedLocation).toHaveBeenCalledWith(
			'u1',
			'c1b2c3d4-e5f6-7890-abcd-ef1234567890',
			'd1b2c3d4-e5f6-7890-abcd-ef1234567890'
		);
	});
});
