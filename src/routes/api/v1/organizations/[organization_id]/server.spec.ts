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

const { getOrganization, replaceOrganization, updateOrganization } = vi.hoisted(() => ({
	getOrganization: vi.fn(),
	replaceOrganization: vi.fn(),
	updateOrganization: vi.fn()
}));

vi.mock('$lib/server/services/organizations.service', () => ({
	getOrganization,
	replaceOrganization,
	updateOrganization
}));

import { GET, PUT, PATCH } from './+server';

const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const params = { organization_id: ORG };
const signedIn = { user: { id: 'u1' } };

function withBody(handler: typeof PUT, body: unknown, p = params, locals: unknown = signedIn) {
	return handler({
		params: p,
		locals,
		request: new Request('http://localhost/api/v1/organizations/x', {
			method: 'PUT',
			body: JSON.stringify(body)
		})
	} as never);
}

beforeEach(() => vi.clearAllMocks());

describe('GET /api/v1/organizations/[organization_id]', () => {
	it('answers 401 when signed out', async () => {
		await expect(GET({ params, locals: {} } as never)).rejects.toMatchObject({ status: 401 });
	});

	it('answers 400 for a malformed id', async () => {
		await expect(
			GET({ params: { organization_id: 'nope' }, locals: signedIn } as never)
		).rejects.toMatchObject({ status: 400 });
	});

	it("returns the service's organization", async () => {
		getOrganization.mockResolvedValue({ id: ORG });

		const res = await GET({ params, locals: signedIn } as never);

		expect(await res.json()).toEqual({ id: ORG });
		expect(getOrganization).toHaveBeenCalledWith('u1', ORG);
	});

	it('passes a service error through', async () => {
		getOrganization.mockRejectedValue({ status: 404 });

		await expect(GET({ params, locals: signedIn } as never)).rejects.toMatchObject({
			status: 404
		});
	});
});

describe('PUT /api/v1/organizations/[organization_id]', () => {
	it('answers 401 when signed out', async () => {
		await expect(withBody(PUT, { name: 'A', slug: 'a' }, params, {})).rejects.toMatchObject({
			status: 401
		});
	});

	it('answers 400 when the slug is missing', async () => {
		await expect(withBody(PUT, { name: 'A' })).rejects.toMatchObject({ status: 400 });
	});

	it('answers 400 for a malformed id', async () => {
		await expect(
			withBody(PUT, { name: 'A', slug: 'a' }, { organization_id: 'nope' })
		).rejects.toMatchObject({ status: 400 });
	});

	it('replaces the organization with the full body', async () => {
		replaceOrganization.mockResolvedValue({ id: ORG });

		const res = await withBody(PUT, { name: 'A', slug: 'a' });

		expect(await res.json()).toEqual({ id: ORG });
		expect(replaceOrganization).toHaveBeenCalledWith('u1', ORG, { name: 'A', slug: 'a' });
	});
});

describe('PATCH /api/v1/organizations/[organization_id]', () => {
	it('answers 401 when signed out', async () => {
		await expect(withBody(PATCH, { name: 'A' }, params, {})).rejects.toMatchObject({
			status: 401
		});
	});

	it('answers 400 for an invalid slug', async () => {
		await expect(withBody(PATCH, { slug: 'Bad Slug' })).rejects.toMatchObject({ status: 400 });
	});

	it('updates only the given fields', async () => {
		updateOrganization.mockResolvedValue({ id: ORG });

		await withBody(PATCH, { name: 'A' });

		expect(updateOrganization).toHaveBeenCalledWith('u1', ORG, { name: 'A' });
	});
});
