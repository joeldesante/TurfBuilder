import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	countOpenSuggestions,
	findEditableSuggestion,
	findWritableTurf,
	isInsideTurf
} from './suggestions.service';

// The gates are SQL; e2e/canvass.spec.ts proves them against the database.
// These check what each function asks for and how it reads the answer.

const client = { query: vi.fn() };

beforeEach(() => {
	client.query.mockReset();
});

describe('findWritableTurf', () => {
	it('asks for a turf the caller joined that has not expired, and returns it or null', async () => {
		client.query.mockResolvedValueOnce({ rows: [{ id: 't1', bounds: null }] });
		expect(await findWritableTurf(client as never, 't1', 'u1', 'o1')).toEqual({
			id: 't1',
			bounds: null
		});

		const [sql, values] = client.query.mock.calls[0];
		expect(sql).toContain('JOIN universe.turf_user');
		expect(sql).toContain('t.expires_at > now()');
		expect(values).toEqual(['t1', 'u1', 'o1']);

		client.query.mockResolvedValueOnce({ rows: [] });
		expect(await findWritableTurf(client as never, 't1', 'u1', 'o1')).toBeNull();
	});
});

describe('isInsideTurf', () => {
	it('passes longitude then latitude, and treats a turf without bounds as no limit', async () => {
		client.query.mockResolvedValueOnce({ rows: [{ inside: false }] });
		expect(await isInsideTurf(client as never, 't1', 'o1', 39.95, -75.16)).toBe(false);
		expect(client.query.mock.calls[0][1]).toEqual(['t1', 'o1', -75.16, 39.95]);

		client.query.mockResolvedValueOnce({ rows: [{ inside: null }] });
		expect(await isInsideTurf(client as never, 't1', 'o1', 0, 0)).toBe(true);
	});
});

describe('countOpenSuggestions', () => {
	it("counts only the volunteer's tentative suggestions on the turf", async () => {
		client.query.mockResolvedValueOnce({ rows: [{ n: 3 }] });

		expect(await countOpenSuggestions(client as never, 't1', 'u1', 'o1')).toBe(3);
		expect(client.query.mock.calls[0][0]).toContain("status = 'tentative'");
	});
});

describe('findEditableSuggestion', () => {
	it('locks the current version of a tentative suggestion the caller wrote on an open turf', async () => {
		client.query.mockResolvedValueOnce({ rows: [] });

		expect(await findEditableSuggestion(client as never, 'e1', 't1', 'u1', 'o1')).toBeNull();
		const [sql, values] = client.query.mock.calls[0];
		expect(sql).toContain("ls.status    = 'tentative'");
		expect(sql).toContain('FOR UPDATE OF c');
		expect(values).toEqual(['e1', 't1', 'u1', 'o1']);
	});
});
