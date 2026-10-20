import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { DATABASE_URL: 'postgresql://test:test@localhost/test' }
}));

const { client, convertAllBucketFilters, backfillActivity, pruneActivity, recordSchemaFingerprint } = vi.hoisted(() => ({
	client: { query: vi.fn(), release: vi.fn() },
	convertAllBucketFilters: vi.fn(),
	backfillActivity: vi.fn(),
	pruneActivity: vi.fn(),
	recordSchemaFingerprint: vi.fn()
}));

vi.mock('$lib/server/database', () => ({
	POOL: { connect: vi.fn(async () => client) }
}));
vi.mock('$lib/server/setup-schema', () => ({
	SETUP_STEPS: [
		{ label: 'First', statements: ['SELECT 1'] },
		{ label: 'Second', statements: ['SELECT 2'] }
	]
}));
vi.mock('$lib/server/permissions', () => ({
	resolveInfraPermissions: vi.fn(async () => ['settings.manage'])
}));
vi.mock('$lib/server/services/buckets.service', () => ({ convertAllBucketFilters }));
vi.mock('$lib/server/services/activity.service', () => ({ backfillActivity, pruneActivity }));
vi.mock('$lib/server/services/migrations.service', () => ({ recordSchemaFingerprint }));

import { POST } from './+server';

/** Every event the migration streams, in order. */
async function run(locals: unknown = { user: { id: 'u1' } }) {
	const res = await POST({ locals } as never);
	const text = await res.text();
	return text
		.split('\n\n')
		.filter(Boolean)
		.map((chunk) => JSON.parse(chunk.replace(/^data: /, '')));
}

beforeEach(() => {
	vi.clearAllMocks();
	client.query.mockResolvedValue({});
	convertAllBucketFilters.mockResolvedValue({ converted: 3, alreadyDone: 1, failed: [] });
	backfillActivity.mockResolvedValue({ inserted: { 'user.signed_up': 4, 'canvass.visit': 6 }, activeDays: 7 });
	pruneActivity.mockResolvedValue(2);
	recordSchemaFingerprint.mockResolvedValue(undefined);
});

describe('POST /api/v1/migrations', () => {
	it('answers 401 when signed out', async () => {
		await expect(POST({ locals: {} } as never)).rejects.toMatchObject({ status: 401 });
	});

	it('runs the schema steps and then the data steps', async () => {
		const events = await run();

		expect(events.filter((e) => e.status === 'done').map((e) => e.label)).toEqual([
			'First',
			'Second',
			'Converting legacy bucket filters',
			'Backfilling activity history',
			'Removing activity past its retention'
		]);
		expect(events.at(-1)).toEqual({ done: true });
	});

	it('counts each data step as a step of the total', async () => {
		const events = await run();

		const done = (label: string) => events.find((e) => e.label === label && e.status === 'done');
		expect(done('Converting legacy bucket filters')).toMatchObject({ step: 3, total: 5 });
		expect(done('Backfilling activity history')).toMatchObject({ step: 4, total: 5 });
		expect(done('Removing activity past its retention')).toMatchObject({ step: 5, total: 5 });
	});

	it('reports how many were converted', async () => {
		const events = await run();

		expect(events.find((e) => e.detail)?.detail).toEqual(['3 converted, 1 already converted.']);
	});

	it('reports what the backfill and pruning did', async () => {
		const events = await run();

		const detail = (label: string) => events.find((e) => e.label === label && e.detail)?.detail;
		expect(detail('Backfilling activity history')).toEqual(['10 events and 7 active days added.']);
		expect(detail('Removing activity past its retention')).toEqual(['2 old events removed.']);
	});

	it('records the schema fingerprint only after every step succeeds', async () => {
		await run();
		expect(recordSchemaFingerprint).toHaveBeenCalledOnce();

		vi.clearAllMocks();
		client.query.mockResolvedValue({});
		convertAllBucketFilters.mockResolvedValue({ converted: 0, alreadyDone: 0, failed: [] });
		backfillActivity.mockRejectedValue(new Error('db down'));

		const events = await run();
		expect(events.at(-1)).toMatchObject({ label: 'Backfilling activity history', status: 'error' });
		expect(recordSchemaFingerprint).not.toHaveBeenCalled();
	});

	it('lists the buckets that could not be converted without failing the migration', async () => {
		convertAllBucketFilters.mockResolvedValue({
			converted: 0,
			alreadyDone: 0,
			failed: [{ orgId: 'o', bucketId: 'b', slug: 'voters', reason: 'locations: Cannot convert "vl.name ="' }]
		});

		const events = await run();

		expect(events.find((e) => e.detail)?.detail).toContain(
			'Could not convert "voters": locations: Cannot convert "vl.name ="'
		);
		expect(events.at(-1)).toEqual({ done: true });
	});

	it('does not convert anything if a schema step fails', async () => {
		client.query.mockRejectedValue(new Error('boom'));

		const events = await run();

		expect(events.some((e) => e.status === 'error')).toBe(true);
		expect(convertAllBucketFilters).not.toHaveBeenCalled();
		expect(events.some((e) => e.done)).toBe(false);
	});

	it('reports a failed conversion as an error and does not finish', async () => {
		convertAllBucketFilters.mockRejectedValue(new Error('db down'));

		const events = await run();

		expect(events.at(-1)).toMatchObject({ label: 'Converting legacy bucket filters', status: 'error' });
		expect(events.some((e) => e.done)).toBe(false);
	});
});
