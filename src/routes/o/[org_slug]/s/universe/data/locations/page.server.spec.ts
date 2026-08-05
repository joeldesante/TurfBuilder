import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { DATABASE_URL: 'postgresql://test:test@localhost/test' }
}));

const mockClient = { query: vi.fn(), release: vi.fn() };

vi.mock('pg', () => ({
	Pool: vi.fn(() => ({
		connect: vi.fn().mockResolvedValue(mockClient),
		on: vi.fn(),
		end: vi.fn()
	}))
}));

import { load } from './+page.server';

const ORG = 'org-1';

const reader = {
	user: { id: 'u1' },
	organization: { id: ORG, permissions: ['location.read'] }
};

const noReader = {
	user: { id: 'u2' },
	organization: { id: ORG, permissions: [] }
};

const EXTENT = { west: -75.3, south: 39.9, east: -75.1, north: 40.1 };

/** Answers each query the load issues, with `count` rows available. */
function withCount(count: number, extent: Record<string, number | null> = EXTENT) {
	mockClient.query.mockImplementation(async (sql: string) => {
		if (sql.includes('COUNT(*)')) return { rows: [{ count: String(count) }] };
		if (sql.includes('ST_Extent')) return { rows: [extent] };
		if (sql.includes('FROM universe.org_location ol')) return { rows: [] };
		return { rows: [] };
	});
}

/** Parameters of the paged SELECT: [orgId, limit, offset]. */
function pageParams() {
	return mockClient.query.mock.calls.find((c) => String(c[0]).includes('LIMIT $2 OFFSET $3'))![1];
}

function event(page?: string) {
	const url = new URL('https://x/o/acme/s/universe/data/locations');
	if (page !== undefined) url.searchParams.set('page', page);
	return { locals: reader, url };
}

beforeEach(() => {
	vi.clearAllMocks();
	withCount(0);
});

describe('locations page load', () => {
	it('throws 403 without location.read', async () => {
		await expect(load({ locals: noReader, url: new URL('https://x/') } as never)).rejects.toMatchObject({
			status: 403
		});
	});

	it('defaults to the first page', async () => {
		withCount(450);

		const data = await load(event() as never);

		expect(data.page).toBe(1);
		expect(pageParams()).toEqual([ORG, 100, 0]);
	});

	it('offsets by whole pages', async () => {
		withCount(450);

		const data = await load(event('3') as never);

		expect(data.page).toBe(3);
		expect(pageParams()).toEqual([ORG, 100, 200]);
	});

	// A bookmarked ?page= outliving the rows it pointed at should land on real
	// records rather than an empty screen.
	it('clamps a page past the end to the last one', async () => {
		withCount(450);

		const data = await load(event('99') as never);

		expect(data.page).toBe(5);
		expect(pageParams()).toEqual([ORG, 100, 400]);
	});

	it('clamps a page below the first', async () => {
		withCount(450);

		const data = await load(event('0') as never);

		expect(data.page).toBe(1);
	});

	it('falls back to the first page for a nonsense page', async () => {
		withCount(450);

		const data = await load(event('banana') as never);

		expect(data.page).toBe(1);
		expect(pageParams()).toEqual([ORG, 100, 0]);
	});

	it('reports the total so the page count can be derived', async () => {
		withCount(450);

		const data = await load(event() as never);

		expect(data.totalCount).toBe(450);
		expect(data.pageSize).toBe(100);
	});

	// The map opens on this, so it has to cover every location rather than the
	// page the list happens to be showing.
	it('returns the extent of all locations as the opening viewport', async () => {
		withCount(450);

		const data = await load(event('4') as never);

		expect(data.initialBounds).toEqual(EXTENT);
	});

	it('returns no bounds when the org has no located records', async () => {
		withCount(0, { west: null, south: null, east: null, north: null });

		const data = await load(event() as never);

		expect(data.initialBounds).toBeNull();
	});

	it('orders by name with a tiebreak, so pages cannot repeat or skip a row', async () => {
		withCount(450);

		await load(event('2') as never);

		const sql = String(
			mockClient.query.mock.calls.find((c) => String(c[0]).includes('LIMIT $2 OFFSET $3'))![0]
		).replace(/\s+/g, ' ');
		expect(sql).toContain('ORDER BY ol.name NULLS LAST, ol.address_line_1 NULLS LAST, ol.id');
	});
});
