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

import { fetchBucketEntityPage } from './bucket-query';
import type { SingleQuery } from './query-builder';

const query: SingleQuery = {
	select: ['vl.id', 'vl.city'],
	from: 'universe.v_locations vl',
	where: {
		type: 'group',
		connector: 'AND',
		negate: false,
		children: [{ type: 'condition', column: 'vl.city', op: '=', negate: false, value: 'Austin' }]
	}
};

const rows = [{ id: 'a' }];
const client = { query: vi.fn() };

/** Answers the COUNT with `total` and the page query with `rows`. */
function stub(total: number) {
	client.query.mockImplementation((sql: string) =>
		Promise.resolve(
			sql.includes('COUNT(*)') ? { rows: [{ count: String(total) }] } : { rows }
		)
	);
}

const pageCall = () => client.query.mock.calls.find((c) => !String(c[0]).includes('COUNT(*)'))!;

beforeEach(() => {
	vi.clearAllMocks();
	stub(250);
});

const run = (requestedPage: number, extra = {}) =>
	fetchBucketEntityPage(client as never, query, { requestedPage, orderBy: 'city, id', ...extra });

describe('fetchBucketEntityPage', () => {
	it('returns the rows with the total, page, and page size', async () => {
		expect(await run(2)).toEqual({ items: rows, totalCount: 250, page: 2, pageSize: 100 });
	});

	it('counts the whole query and reuses its parameters', async () => {
		await run(1);

		const [sql, params] = client.query.mock.calls[0];
		expect(sql).toContain('SELECT COUNT(*)::text AS count FROM (SELECT vl.id, vl.city FROM');
		expect(sql).not.toContain(';');
		expect(params).toEqual(['Austin']);
	});

	it('orders the page and offsets by whole pages', async () => {
		await run(3);

		const [sql, params] = pageCall();
		expect(sql).toContain('ORDER BY city, id LIMIT $2 OFFSET $3');
		expect(params).toEqual(['Austin', 100, 200]);
	});

	it('honors a page size', async () => {
		await run(2, { pageSize: 10 });

		expect(pageCall()[1]).toEqual(['Austin', 10, 10]);
	});

	it.each([
		['past the end', 99, 3],
		['zero', 0, 1],
		['negative', -4, 1],
		['not a number', NaN, 1]
	])('clamps a page number %s', async (_name, requested, expected) => {
		expect((await run(requested)).page).toBe(expected);
	});

	it('treats a fractional page as its whole part', async () => {
		expect((await run(2.9)).page).toBe(2);
	});

	it('returns page 1 with no rows needed when nothing matches', async () => {
		stub(0);

		expect(await run(5)).toMatchObject({ totalCount: 0, page: 1 });
		expect(pageCall()[1]).toEqual(['Austin', 100, 0]);
	});
});
