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

import {
	listBuckets,
	createBucket,
	getBucket,
	replaceBucket,
	updateBucket
} from './buckets.service';

const input = { name: 'Voters', slug: 'voters', filter: { type: 'person' } };

/** Answers membership, the bucket-in-org lookup, and everything else with `rest`. */
function stub(rest: (sql: string, values?: unknown[]) => unknown = () => found, member = true) {
	mockClient.query.mockImplementation((sql: string, values?: unknown[]) => {
		if (sql.includes('FROM auth.member')) {
			return Promise.resolve(
				member ? { rowCount: 1, rows: [{ organization_id: ORG }] } : { rowCount: 0, rows: [] }
			);
		}
		if (sql.includes('SELECT 1 FROM universe.bucket')) return Promise.resolve(found);
		return Promise.resolve(rest(sql, values));
	});
}

function sqlRun(fragment: string) {
	return mockClient.query.mock.calls.find((c) => String(c[0]).includes(fragment));
}

beforeEach(() => {
	vi.clearAllMocks();
	canOrg.mockResolvedValue(true);
	stub();
});

describe('listBuckets', () => {
	it("selects only the org's buckets", async () => {
		await listBuckets('u1', ORG);

		expect(sqlRun('FROM universe.bucket WHERE org_id = $1')![1]).toEqual([ORG]);
	});

	it('returns 404 for a non-member and queries nothing', async () => {
		stub(() => found, false);

		await expect(listBuckets('u1', ORG)).rejects.toMatchObject({ status: 404 });
		expect(sqlRun('FROM universe.bucket WHERE org_id')).toBeUndefined();
	});

	it('returns 403 without staff access', async () => {
		canOrg.mockResolvedValue(false);

		await expect(listBuckets('u1', ORG)).rejects.toMatchObject({ status: 403 });
	});
});

describe('createBucket', () => {
	it('inserts into the org with the filter as JSON', async () => {
		await createBucket('u1', ORG, input);

		expect(sqlRun('INSERT INTO universe.bucket')![1]).toEqual([
			'Voters',
			'voters',
			ORG,
			JSON.stringify(input.filter)
		]);
	});

	it('returns 409 when the slug is taken', async () => {
		stub((sql) => {
			if (sql.includes('INSERT INTO universe.bucket'))
				throw Object.assign(new Error(), { code: '23505' });
			return found;
		});

		await expect(createBucket('u1', ORG, input)).rejects.toMatchObject({ status: 409 });
	});

	it('returns 403 without staff access and inserts nothing', async () => {
		canOrg.mockResolvedValue(false);

		await expect(createBucket('u1', ORG, input)).rejects.toMatchObject({ status: 403 });
		expect(sqlRun('INSERT INTO')).toBeUndefined();
	});
});

describe('getBucket', () => {
	it('scopes the select to the bucket and org', async () => {
		await getBucket('u1', BUCKET);

		expect(sqlRun('WHERE id = $1 AND org_id = $2')![1]).toEqual([BUCKET, ORG]);
	});

	it('returns 404 when no org of the caller has it', async () => {
		stub(() => found, false);

		await expect(getBucket('u1', BUCKET)).rejects.toMatchObject({ status: 404 });
	});

	it('returns 403 without staff access', async () => {
		canOrg.mockResolvedValue(false);

		await expect(getBucket('u1', BUCKET)).rejects.toMatchObject({ status: 403 });
	});
});

describe('replaceBucket and updateBucket', () => {
	it('replace sends all three fields', async () => {
		await replaceBucket('u1', BUCKET, input);

		expect(sqlRun('UPDATE universe.bucket')![1]).toEqual([
			BUCKET,
			ORG,
			'Voters',
			'voters',
			JSON.stringify(input.filter)
		]);
	});

	it('update sends null for the fields left out so they keep their value', async () => {
		await updateBucket('u1', BUCKET, { name: 'New' });

		expect(sqlRun('UPDATE universe.bucket')![1]).toEqual([BUCKET, ORG, 'New', null, null]);
	});

	it('returns 409 when the slug is taken', async () => {
		stub((sql) => {
			if (sql.includes('UPDATE universe.bucket'))
				throw Object.assign(new Error(), { code: '23505' });
			return found;
		});

		await expect(updateBucket('u1', BUCKET, { slug: 'x' })).rejects.toMatchObject({
			status: 409
		});
	});

	it('returns 403 without staff access and updates nothing', async () => {
		canOrg.mockResolvedValue(false);

		await expect(updateBucket('u1', BUCKET, { name: 'x' })).rejects.toMatchObject({
			status: 403
		});
		expect(sqlRun('UPDATE universe.bucket')).toBeUndefined();
	});
});
