import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { DATABASE_URL: 'postgresql://test:test@localhost/test' }
}));

const { client, convertAllBucketFilters } = vi.hoisted(() => ({
	client: { query: vi.fn(), release: vi.fn() },
	convertAllBucketFilters: vi.fn()
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
});

describe('POST /infra/migrate/api', () => {
	it('answers 401 when signed out', async () => {
		await expect(POST({ locals: {} } as never)).rejects.toMatchObject({ status: 401 });
	});

	it('runs the schema steps and then converts the legacy bucket filters', async () => {
		const events = await run();

		expect(events.filter((e) => e.status === 'done').map((e) => e.label)).toEqual([
			'First',
			'Second',
			'Converting legacy bucket filters'
		]);
		expect(events.at(-1)).toEqual({ done: true });
	});

	it('counts the conversion as a step of the total', async () => {
		const events = await run();

		const conversion = events.find((e) => e.label === 'Converting legacy bucket filters' && e.status === 'done');
		expect(conversion).toMatchObject({ step: 3, total: 3 });
	});

	it('reports how many were converted', async () => {
		const events = await run();

		expect(events.find((e) => e.detail)?.detail).toEqual(['3 converted, 1 already converted.']);
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
