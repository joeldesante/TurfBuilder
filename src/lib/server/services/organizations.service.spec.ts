import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { DATABASE_URL: 'postgresql://test:test@localhost/test' }
}));

const { mockClient, canOrg } = vi.hoisted(() => ({
	mockClient: { query: vi.fn(), release: vi.fn() },
	canOrg: vi.fn()
}));

// A function expression, not an arrow: the Pool mock is called with `new`.
vi.mock('pg', () => ({
	Pool: vi.fn(function () {
		return {
			query: mockClient.query,
			connect: vi.fn().mockResolvedValue(mockClient),
			on: vi.fn(),
			end: vi.fn()
		};
	})
}));

vi.mock('$lib/server/permissions', () => ({ canOrg }));

const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const createOrganizationApi = vi.hoisted(() => vi.fn());
vi.mock('$lib/auth', () => ({
	getAuth: vi.fn().mockResolvedValue({ api: { createOrganization: createOrganizationApi } })
}));

import {
	createOrganization,
	getOrganization,
	replaceOrganization,
	updateOrganization
} from './organizations.service';

const input = { name: 'Acme', slug: 'acme' };

function stub({ role = 'owner' as string | null, creation = 'true', slugTaken = false } = {}) {
	mockClient.query.mockImplementation((sql: string) => {
		if (sql.includes('FROM auth.member')) {
			return Promise.resolve(role ? { rowCount: 1, rows: [{ role }] } : { rowCount: 0, rows: [] });
		}
		if (sql.includes('system_setting')) return Promise.resolve({ rows: [{ value: creation }] });
		if (sql.includes('SELECT 1 FROM auth.organization')) {
			return Promise.resolve({ rowCount: slugTaken ? 1 : 0, rows: [] });
		}
		return Promise.resolve({ rowCount: 1, rows: [{ id: ORG, ...input }] });
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	stub();
});

describe('createOrganization', () => {
	it('creates through better-auth with the request headers', async () => {
		createOrganizationApi.mockResolvedValue({ id: ORG, ...input, createdAt: new Date(0) });
		const headers = new Headers({ cookie: 'x' });

		const org = await createOrganization('u1', input, headers);

		expect(createOrganizationApi).toHaveBeenCalledWith({ headers, body: input });
		expect(org).toMatchObject({ id: ORG, slug: 'acme' });
	});

	it('returns 403 when creation is disabled', async () => {
		stub({ creation: 'false' });

		await expect(createOrganization('u1', input, new Headers())).rejects.toMatchObject({
			status: 403
		});
		expect(createOrganizationApi).not.toHaveBeenCalled();
	});

	it('returns 409 when the slug is taken', async () => {
		stub({ slugTaken: true });

		await expect(createOrganization('u1', input, new Headers())).rejects.toMatchObject({
			status: 409
		});
		expect(createOrganizationApi).not.toHaveBeenCalled();
	});
});

describe('getOrganization', () => {
	it('returns the organization to a member', async () => {
		stub({ role: 'member' });

		await expect(getOrganization('u1', ORG)).resolves.toMatchObject({ id: ORG });
	});

	it('returns 404 to a non-member', async () => {
		stub({ role: null });

		await expect(getOrganization('u1', ORG)).rejects.toMatchObject({ status: 404 });
	});
});

describe('replaceOrganization and updateOrganization', () => {
	function update() {
		return mockClient.query.mock.calls.find((c) =>
			String(c[0]).includes('UPDATE auth.organization')
		);
	}

	it('replace sends both fields', async () => {
		await replaceOrganization('u1', ORG, input);

		expect(update()![1]).toEqual([ORG, 'Acme', 'acme']);
	});

	it('update sends null for the field left out', async () => {
		await updateOrganization('u1', ORG, { name: 'New' });

		expect(update()![1]).toEqual([ORG, 'New', null]);
	});

	it('returns 403 to a member who is not an owner and updates nothing', async () => {
		stub({ role: 'member' });

		await expect(updateOrganization('u1', ORG, { name: 'x' })).rejects.toMatchObject({
			status: 403
		});
		expect(update()).toBeUndefined();
	});

	it('returns 404 to a non-member', async () => {
		stub({ role: null });

		await expect(updateOrganization('u1', ORG, { name: 'x' })).rejects.toMatchObject({
			status: 404
		});
	});

	it('returns 409 when the slug is taken', async () => {
		mockClient.query.mockImplementation((sql: string) => {
			if (sql.includes('FROM auth.member'))
				return Promise.resolve({ rowCount: 1, rows: [{ role: 'owner' }] });
			throw Object.assign(new Error(), { code: '23505' });
		});

		await expect(updateOrganization('u1', ORG, { slug: 'x' })).rejects.toMatchObject({
			status: 409
		});
	});
});
