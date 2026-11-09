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
	importLocationsCsv: vi.fn()
}));

vi.mock('$lib/server/services/locations.service', () => mocks);

import { POST } from './+server';

const params = { organization_id: 'c1b2c3d4-e5f6-7890-abcd-ef1234567890' };
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
		request = new Request(
			'http://localhost/api/v1/organizations/[organization_id]/location-imports',
			{ method: 'POST', body: form }
		);
	} else {
		request = new Request(
			'http://localhost/api/v1/organizations/[organization_id]/location-imports' +
				(query ? `?${query}` : ''),
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
	mocks.importLocationsCsv.mockResolvedValue({ ok: true });
});

describe('POST /api/v1/organizations/[organization_id]/location-imports', () => {
	it('answers 401 when signed out', async () => {
		await expect(
			call(POST, { locals: {}, file: 'name,latitude,longitude\nDeli,39.9,-75.1\n' })
		).rejects.toMatchObject({ status: 401 });
		expect(mocks.importLocationsCsv).not.toHaveBeenCalled();
	});

	it('answers 400 for a malformed id', async () => {
		await expect(
			call(POST, {
				routeParams: { ...params, organization_id: 'nope' },
				file: 'name,latitude,longitude\nDeli,39.9,-75.1\n'
			})
		).rejects.toMatchObject({ status: 400 });
		expect(mocks.importLocationsCsv).not.toHaveBeenCalled();
	});

	it('asks the service as the caller and answers 201', async () => {
		const res = await call(POST, { file: 'name,latitude,longitude\nDeli,39.9,-75.1\n' });

		expect(res.status).toBe(201);
		expect(mocks.importLocationsCsv).toHaveBeenCalledWith(
			'u1',
			'c1b2c3d4-e5f6-7890-abcd-ef1234567890',
			'name,latitude,longitude\nDeli,39.9,-75.1\n'
		);
	});
});
