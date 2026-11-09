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
const SCRIPT = 'c1b2c3d4-e5f6-7890-abcd-ef1234567890';
const found = { rowCount: 1, rows: [{ id: SCRIPT }] };

import { listBucketScripts, createScript, getScript, updateScript } from './scripts.service';

/** Answers membership and the bucket and script lookups, and everything else with `rest`. */
function stub(rest: (sql: string, values?: unknown[]) => unknown = () => found) {
	mockClient.query.mockImplementation((sql: string, values?: unknown[]) => {
		if (sql.includes('FROM auth.member')) {
			return Promise.resolve({ rowCount: 1, rows: [{ organization_id: ORG }] });
		}
		if (sql.includes('SELECT 1 FROM universe.bucket')) return Promise.resolve(found);
		if (sql.includes('SELECT 1 FROM universe.script WHERE')) return Promise.resolve(found);
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

describe('every operation', () => {
	it.each([
		['listBucketScripts', () => listBucketScripts('u1', BUCKET)],
		['createScript', () => createScript('u1', BUCKET, { name: 'A' })],
		['getScript', () => getScript('u1', SCRIPT)],
		['updateScript', () => updateScript('u1', SCRIPT, { contents: 'Hi' })]
	])('%s answers 403 without staff access and changes nothing', async (_name, run) => {
		canOrg.mockResolvedValue(false);

		await expect(run()).rejects.toMatchObject({ status: 403 });

		const sql = mockClient.query.mock.calls.map((c) => String(c[0])).join('\n');
		expect(sql).not.toMatch(/INSERT INTO universe|UPDATE universe/);
	});

	it.each([
		['getScript', () => getScript('u1', SCRIPT)],
		['updateScript', () => updateScript('u1', SCRIPT, { name: 'A' })]
	])("%s answers 404 for a script in none of the user's orgs", async (_name, run) => {
		mockClient.query.mockImplementation((sql: string) =>
			Promise.resolve(
				sql.includes('FROM auth.member')
					? { rowCount: 1, rows: [{ organization_id: ORG }] }
					: { rowCount: 0, rows: [] }
			)
		);

		await expect(run()).rejects.toMatchObject({ status: 404 });
	});

	it("answers 404 for a bucket in none of the user's orgs", async () => {
		mockClient.query.mockImplementation((sql: string) =>
			Promise.resolve(
				sql.includes('FROM auth.member')
					? { rowCount: 1, rows: [{ organization_id: ORG }] }
					: { rowCount: 0, rows: [] }
			)
		);

		await expect(createScript('u1', BUCKET, { name: 'A' })).rejects.toMatchObject({ status: 404 });
	});
});

describe('listBucketScripts', () => {
	it('lists the bucket in its org, without the script text', async () => {
		await listBucketScripts('u1', BUCKET);

		const [sql, values] = sqlRun('FROM universe.script\n')!;
		expect(sql).toContain('bucket AS bucket_id');
		expect(sql).not.toContain('contents');
		expect(values).toEqual([BUCKET, ORG]);
	});
});

describe('createScript', () => {
	it('starts the script empty when no contents are given', async () => {
		await createScript('u1', BUCKET, { name: 'Doorstep' });

		expect(sqlRun('INSERT INTO universe.script')![1]).toEqual(['Doorstep', '', BUCKET, ORG]);
	});

	it('keeps the contents it is given', async () => {
		await createScript('u1', BUCKET, { name: 'Doorstep', contents: 'Hello' });

		expect(sqlRun('INSERT INTO universe.script')![1]).toEqual(['Doorstep', 'Hello', BUCKET, ORG]);
	});
});

describe('updateScript', () => {
	it('passes null for omitted fields so they keep their value', async () => {
		await updateScript('u1', SCRIPT, { contents: 'New text' });

		expect(sqlRun('UPDATE universe.script')![1]).toEqual([SCRIPT, ORG, null, 'New text']);
	});

	it('answers 404 when the script is gone by the time it is updated', async () => {
		stub((sql) => (sql.includes('UPDATE universe.script') ? { rowCount: 0, rows: [] } : found));

		await expect(updateScript('u1', SCRIPT, { name: 'A' })).rejects.toMatchObject({ status: 404 });
	});
});
