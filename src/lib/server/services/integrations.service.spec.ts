import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({
	pool: { query: vi.fn() },
	client: { query: vi.fn() },
	requireOrgPermission: vi.fn(async () => undefined),
	requireInfraPermission: vi.fn(async () => undefined),
	audit: vi.fn(async () => undefined)
}));

vi.mock('$lib/server/database', () => ({
	POOL: m.pool,
	withTransaction: async (fn: (c: unknown) => unknown) => fn(m.client)
}));
vi.mock('$lib/server/list-access', () => ({ requireOrgPermission: m.requireOrgPermission }));
vi.mock('$lib/server/permissions', () => ({ requireInfraPermission: m.requireInfraPermission }));
vi.mock('./audit.service', () => ({ audit: m.audit }));

import { listIntegrations, setIntegrationEnabled } from './integrations.service';
import { INTEGRATIONS } from '$lib/server/integrations';

const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const forbidden = () => Object.assign(new Error('Forbidden'), { status: 403 });

beforeEach(() => {
	vi.clearAllMocks();
	m.pool.query.mockResolvedValue({ rows: [] });
});

describe('listIntegrations', () => {
	it('needs staff access in the org', async () => {
		m.requireOrgPermission.mockRejectedValueOnce(forbidden());

		await expect(listIntegrations('u1', ORG)).rejects.toMatchObject({ status: 403 });
		expect(m.requireOrgPermission).toHaveBeenCalledWith('u1', ORG, 'system.access');
	});

	it('lists every integration, off unless its setting is "true"', async () => {
		const [first] = INTEGRATIONS;
		m.pool.query.mockResolvedValue({
			rows: [{ key: `integration.${first.id}.enabled`, value: 'true' }]
		});

		const list = await listIntegrations('u1', ORG);

		expect(list).toHaveLength(INTEGRATIONS.length);
		expect(list.find((i) => i.id === first.id)?.enabled).toBe(true);
		expect(list.filter((i) => i.id !== first.id).every((i) => !i.enabled)).toBe(true);
	});
});

describe('setIntegrationEnabled', () => {
	it('needs infra settings.manage, since the flag is the same for every organization', async () => {
		m.requireInfraPermission.mockRejectedValueOnce(forbidden());

		await expect(setIntegrationEnabled('u1', INTEGRATIONS[0].id, true)).rejects.toMatchObject({
			status: 403
		});
		expect(m.requireInfraPermission).toHaveBeenCalledWith('u1', 'settings.manage');
		expect(m.client.query).not.toHaveBeenCalled();
	});

	it('answers 404 for an unknown integration', async () => {
		await expect(setIntegrationEnabled('u1', 'nope', true)).rejects.toMatchObject({ status: 404 });
	});

	it('saves the flag and audits the change', async () => {
		const id = INTEGRATIONS[0].id;

		await setIntegrationEnabled('u1', id, false);

		expect(m.client.query.mock.calls[0][1].slice(0, 2)).toEqual([
			`integration.${id}.enabled`,
			'false'
		]);
		expect(m.audit).toHaveBeenCalledWith(
			'u1',
			'settings.update',
			{ type: 'setting' },
			{ changes: [{ key: `integration.${id}.enabled`, to: 'false' }] },
			m.client
		);
	});
});
