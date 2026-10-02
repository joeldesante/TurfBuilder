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
const BUCKET = 'b1b2c3d4-e5f6-7890-abcd-ef1234567890';
const found = { rowCount: 1, rows: [{ id: BUCKET }] };

import { listBucketLists } from './lists.service';

function stub(member = true) {
	mockClient.query.mockImplementation((sql: string) => {
		if (sql.includes('FROM auth.member')) {
			return Promise.resolve(
				member ? { rowCount: 1, rows: [{ organization_id: ORG }] } : { rowCount: 0, rows: [] }
			);
		}
		return Promise.resolve(found);
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	canOrg.mockResolvedValue(true);
	stub();
});

describe('listBucketLists', () => {
	it("selects the bucket's lists scoped to the org", async () => {
		await listBucketLists('u1', BUCKET);

		const select = mockClient.query.mock.calls.find((c) =>
			String(c[0]).includes('FROM universe.list')
		)!;
		expect(select[0]).toContain('bucket = $1 AND org_id = $2');
		expect(select[1]).toEqual([BUCKET, ORG]);
	});

	it("returns 404 when the bucket is in none of the caller's orgs", async () => {
		stub(false);

		await expect(listBucketLists('u1', BUCKET)).rejects.toMatchObject({ status: 404 });
	});

	it('returns 403 without staff access', async () => {
		canOrg.mockResolvedValue(false);

		await expect(listBucketLists('u1', BUCKET)).rejects.toMatchObject({ status: 403 });
	});
});
