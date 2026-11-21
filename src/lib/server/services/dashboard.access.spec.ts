// getDashboard's access check and bucket lookup. The queries themselves are
// covered in dashboard.service.spec.ts.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({
	client: { query: vi.fn(async () => ({ rows: [{}] })) },
	canOrg: vi.fn(async () => true),
	findBucketBySlug: vi.fn()
}));

vi.mock('$lib/server/database', () => ({
	withOrgTransaction: async (_org: string, fn: (c: unknown) => unknown) => fn(m.client)
}));
vi.mock('$lib/server/permissions', () => ({ canOrg: m.canOrg }));
vi.mock('./buckets.service', () => ({ findBucketBySlug: m.findBucketBySlug }));

import { getDashboard } from './dashboard.service';

const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

beforeEach(() => {
	vi.clearAllMocks();
	m.canOrg.mockResolvedValue(true);
});

describe('getDashboard', () => {
	it('answers 403 without staff access and reads nothing', async () => {
		m.canOrg.mockResolvedValue(false);

		await expect(getDashboard('u1', ORG, null, 'all')).rejects.toMatchObject({ status: 403 });
		expect(m.client.query).not.toHaveBeenCalled();
	});

	it('covers the whole universe without a bucket', async () => {
		const dashboard = await getDashboard('u1', ORG, null, 'all');

		expect(m.findBucketBySlug).not.toHaveBeenCalled();
		expect(dashboard).toHaveProperty('progress');
		expect(dashboard).toHaveProperty('points');
	});

	it('looks the bucket up by slug in the org', async () => {
		m.findBucketBySlug.mockResolvedValue(null);

		await getDashboard('u1', ORG, 'voters', '30d');

		expect(m.findBucketBySlug).toHaveBeenCalledWith(m.client, ORG, 'voters');
	});
});
