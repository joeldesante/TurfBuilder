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

const { createOrganization } = vi.hoisted(() => ({
	createOrganization: vi.fn()
}));

vi.mock('$lib/server/services/organizations.service', () => ({ createOrganization }));

import { POST } from './+server';

const signedIn = { user: { id: 'u1' } };

function post(body: unknown, locals: unknown = signedIn) {
	return POST({
		locals,
		request: new Request('http://localhost/api/v1/organizations', {
			method: 'POST',
			body: JSON.stringify(body)
		})
	} as never);
}

beforeEach(() => vi.clearAllMocks());

describe('POST /api/v1/organizations', () => {
	it('answers 401 when signed out', async () => {
		await expect(post({ name: 'Acme', slug: 'acme' }, {})).rejects.toMatchObject({ status: 401 });
	});

	it('answers 400 for a missing name', async () => {
		await expect(post({ slug: 'acme' })).rejects.toMatchObject({ status: 400 });
	});

	it('answers 400 for an invalid slug', async () => {
		await expect(post({ name: 'Acme', slug: 'Not A Slug' })).rejects.toMatchObject({
			status: 400
		});
	});

	it('creates the organization and answers 201', async () => {
		const created = { id: 'o1', name: 'Acme', slug: 'acme', created_at: 'now' };
		createOrganization.mockResolvedValue(created);

		const res = await post({ name: 'Acme', slug: 'acme' });

		expect(res.status).toBe(201);
		expect(await res.json()).toEqual(created);
		expect(createOrganization).toHaveBeenCalledWith(
			'u1',
			{ name: 'Acme', slug: 'acme' },
			expect.any(Headers)
		);
	});

	it('does not call the service for an invalid body', async () => {
		await expect(post({ slug: 'acme' })).rejects.toMatchObject({ status: 400 });
		expect(createOrganization).not.toHaveBeenCalled();
	});
});
