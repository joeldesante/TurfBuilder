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
vi.mock('$lib/server/services/platform-organizations.service', () => ({ listOrgs: vi.fn() }));

import { POST } from './+server';

const signedIn = { user: { id: 'u1' } };

const profile = { category: 'nonprofit', description: 'We canvass for tenant rights.' };

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
		await expect(post({ name: 'Acme', slug: 'acme', ...profile }, {})).rejects.toMatchObject({
			status: 401
		});
	});

	it('answers 400 for a missing name', async () => {
		await expect(post({ slug: 'acme', ...profile })).rejects.toMatchObject({ status: 400 });
	});

	it('answers 400 for an invalid slug', async () => {
		await expect(post({ name: 'Acme', slug: 'Not A Slug', ...profile })).rejects.toMatchObject({
			status: 400
		});
	});

	it('creates the organization and answers 201', async () => {
		const created = { id: 'o1', name: 'Acme', slug: 'acme', created_at: 'now' };
		createOrganization.mockResolvedValue(created);

		const res = await post({ name: 'Acme', slug: 'acme', ...profile });

		expect(res.status).toBe(201);
		expect(await res.json()).toEqual(created);
		expect(createOrganization).toHaveBeenCalledWith(
			'u1',
			{ name: 'Acme', slug: 'acme', ...profile, is_candidate: false },
			expect.any(Headers)
		);
	});

	it('answers 400 without a category or description', async () => {
		await expect(post({ name: 'Acme', slug: 'acme' })).rejects.toMatchObject({ status: 400 });
		await expect(
			post({ name: 'Acme', slug: 'acme', category: 'nonprofit', description: '  ' })
		).rejects.toMatchObject({ status: 400 });
	});

	it('answers 400 for an unknown category', async () => {
		await expect(
			post({ name: 'Acme', slug: 'acme', ...profile, category: 'church' })
		).rejects.toMatchObject({
			status: 400
		});
	});

	it('answers 400 for a political candidate without a campaign registration', async () => {
		await expect(
			post({ name: 'Acme', slug: 'acme', ...profile, category: 'political', is_candidate: true })
		).rejects.toMatchObject({ status: 400 });
	});

	it('accepts a political candidate with a campaign registration', async () => {
		createOrganization.mockResolvedValue({ id: 'o1' });
		const body = {
			name: 'Acme',
			slug: 'acme',
			...profile,
			category: 'political',
			is_candidate: true,
			campaign_registration: 'C00123456'
		};

		const res = await post(body);

		expect(res.status).toBe(201);
		expect(createOrganization).toHaveBeenCalledWith('u1', body, expect.any(Headers));
	});

	it('does not call the service for an invalid body', async () => {
		await expect(post({ slug: 'acme' })).rejects.toMatchObject({ status: 400 });
		expect(createOrganization).not.toHaveBeenCalled();
	});
});
