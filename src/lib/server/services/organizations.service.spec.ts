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

const { canInfra, getOrg } = vi.hoisted(() => ({
	canInfra: vi.fn(async () => false),
	getOrg: vi.fn()
}));
vi.mock('$lib/server/permissions', () => ({ canOrg, canInfra }));
vi.mock('./platform-organizations.service', () => ({ getOrg }));

const { capture } = vi.hoisted(() => ({ capture: vi.fn() }));
vi.mock('$lib/server/analytics', () => ({ analytics: { capture } }));

const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const createOrganizationApi = vi.hoisted(() => vi.fn());
vi.mock('$lib/auth', () => ({
	getAuth: vi.fn().mockResolvedValue({ api: { createOrganization: createOrganizationApi } })
}));

import {
	createOrganization,
	getOrganization,
	isSlugAvailable,
	replaceOrganization,
	updateOrganization
} from './organizations.service';

const input = { name: 'Acme', slug: 'acme' };
const createInput = {
	...input,
	category: 'nonprofit' as const,
	description: 'We canvass for tenant rights.',
	is_candidate: false
};

/** The UPDATE that saves the profile on the new organization, if one was made. */
function profileUpdate() {
	return mockClient.query.mock.calls.find(([sql]) => String(sql).includes('SET category'));
}

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

		const org = await createOrganization('u1', createInput, headers);

		expect(createOrganizationApi).toHaveBeenCalledWith({ headers, body: input });
		expect(org).toMatchObject({ id: ORG, slug: 'acme' });
	});

	it('saves the profile answers on the new organization', async () => {
		createOrganizationApi.mockResolvedValue({ id: ORG, ...input, createdAt: new Date(0) });

		await createOrganization('u1', createInput, new Headers());

		expect(profileUpdate()?.[1]).toEqual([
			ORG,
			'nonprofit',
			'We canvass for tenant rights.',
			false,
			null
		]);
	});

	it('keeps the campaign registration for a political candidate', async () => {
		createOrganizationApi.mockResolvedValue({ id: ORG, ...input, createdAt: new Date(0) });

		await createOrganization(
			'u1',
			{ ...createInput, category: 'political', is_candidate: true, campaign_registration: 'C001' },
			new Headers()
		);

		expect(profileUpdate()?.[1]).toEqual([ORG, 'political', createInput.description, true, 'C001']);
	});

	it('drops the candidate answers for an organization that is not political', async () => {
		createOrganizationApi.mockResolvedValue({ id: ORG, ...input, createdAt: new Date(0) });

		await createOrganization(
			'u1',
			{ ...createInput, category: 'commercial', is_candidate: true, campaign_registration: 'C001' },
			new Headers()
		);

		expect(profileUpdate()?.[1]).toEqual([ORG, 'commercial', createInput.description, false, null]);
	});

	it('still returns the organization when saving the profile fails', async () => {
		createOrganizationApi.mockResolvedValue({ id: ORG, ...input, createdAt: new Date(0) });
		const query = mockClient.query.getMockImplementation()!;
		mockClient.query.mockImplementation((sql: string) =>
			sql.includes('SET category') ? Promise.reject(new Error('boom')) : query(sql)
		);

		await expect(createOrganization('u1', createInput, new Headers())).resolves.toMatchObject({
			id: ORG
		});
	});

	it('records the organization_created event for the creator', async () => {
		createOrganizationApi.mockResolvedValue({ id: ORG, ...input, createdAt: new Date(0) });

		await createOrganization('u1', createInput, new Headers());

		expect(capture).toHaveBeenCalledWith('u1', 'organization_created', {
			organization_id: ORG,
			category: 'nonprofit'
		});
	});

	it('does not record the event when the slug is taken', async () => {
		stub({ slugTaken: true });

		await expect(createOrganization('u1', createInput, new Headers())).rejects.toBeTruthy();
		expect(capture).not.toHaveBeenCalled();
	});

	it('returns 403 when creation is disabled', async () => {
		stub({ creation: 'false' });

		await expect(createOrganization('u1', createInput, new Headers())).rejects.toMatchObject({
			status: 403
		});
		expect(createOrganizationApi).not.toHaveBeenCalled();
	});

	it('returns 409 when the slug is taken', async () => {
		stub({ slugTaken: true });

		await expect(createOrganization('u1', createInput, new Headers())).rejects.toMatchObject({
			status: 409
		});
		expect(createOrganizationApi).not.toHaveBeenCalled();
	});
});

describe('isSlugAvailable', () => {
	it('is true when no organization uses the slug', async () => {
		stub({ slugTaken: false });

		await expect(isSlugAvailable('acme')).resolves.toBe(true);
	});

	it('is false when an organization uses the slug', async () => {
		stub({ slugTaken: true });

		await expect(isSlugAvailable('acme')).resolves.toBe(false);
	});

	it('looks the slug up with a parameter, not interpolation', async () => {
		await isSlugAvailable("acme'; DROP TABLE auth.organization; --");

		expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('slug = $1'), [
			"acme'; DROP TABLE auth.organization; --"
		]);
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

	it('lets an infra admin read any organization, with its platform detail', async () => {
		stub({ role: null });
		canInfra.mockResolvedValueOnce(true);
		getOrg.mockResolvedValueOnce({ id: ORG, memberCount: 12 });

		await expect(getOrganization('u1', ORG)).resolves.toMatchObject({
			id: ORG,
			platform: { memberCount: 12 }
		});
		expect(getOrg).toHaveBeenCalledWith('u1', ORG);
	});

	it('leaves platform detail out for members', async () => {
		stub({ role: 'member' });

		expect(await getOrganization('u1', ORG)).not.toHaveProperty('platform');
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
