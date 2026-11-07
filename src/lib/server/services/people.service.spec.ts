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
const rows = [{ id: 'r1' }];

/**
 * Answers membership, the in-org lookups, the COUNT with `total`, and
 * everything else with `rest`. `member` false makes the caller a non-member.
 */
function stub(
	total: number,
	rest: (sql: string) => unknown = () => ({ rowCount: rows.length, rows }),
	member = true,
	status: 'active' | 'suspended' | 'deleted' = 'active'
) {
	mockClient.query.mockImplementation((sql: string) => {
		// Membership with the org's status (requireActiveMembership, findInMemberOrgs).
		if (sql.includes('JOIN auth.organization o ON o.id = m.organization_id')) {
			return Promise.resolve(
				member
					? {
							rowCount: 1,
							rows: [
								{
									organization_id: ORG,
									role: 'member',
									suspended: status === 'suspended',
									deleted: status === 'deleted'
								}
							]
						}
					: { rowCount: 0, rows: [] }
			);
		}
		if (sql.includes('FROM auth.member WHERE user_id')) {
			return Promise.resolve(
				member ? { rowCount: 1, rows: [{ organization_id: ORG }] } : { rowCount: 0, rows: [] }
			);
		}
		if (sql.includes('SELECT organization_id FROM auth.member')) {
			return Promise.resolve(
				member ? { rowCount: 1, rows: [{ organization_id: ORG }] } : { rowCount: 0, rows: [] }
			);
		}
		if (sql.startsWith('SELECT 1 FROM')) return Promise.resolve({ rowCount: 1, rows: [{}] });
		if (sql.includes('COUNT(*)'))
			return Promise.resolve({ rowCount: 1, rows: [{ count: String(total) }] });
		return Promise.resolve(rest(sql));
	});
}

/** [sql, params] of the first query containing `fragment`. */
function sqlRun(fragment: string) {
	return mockClient.query.mock.calls.find((c) => String(c[0]).includes(fragment));
}

function flat(sql: unknown) {
	return String(sql).replace(/\s+/g, ' ');
}

import { listOrgPeople, getPerson, importPeopleCsv } from './people.service';

beforeEach(() => {
	vi.clearAllMocks();
	canOrg.mockResolvedValue(true);
	stub(250);
});

describe('listOrgPeople', () => {
	it('returns the page with the total', async () => {
		expect(await listOrgPeople('u1', ORG, 2)).toEqual({
			items: rows,
			totalCount: 250,
			page: 2,
			pageSize: 100
		});
	});

	it('checks system.access', async () => {
		await listOrgPeople('u1', ORG, 1);

		expect(canOrg).toHaveBeenCalledWith(expect.anything(), 'u1', ORG, 'system.access');
	});

	it('answers 403 without system.access and reads nothing', async () => {
		canOrg.mockResolvedValue(false);

		await expect(listOrgPeople('u1', ORG, 1)).rejects.toMatchObject({ status: 403 });
		expect(sqlRun('LIMIT $2 OFFSET $3')).toBeUndefined();
	});

	it('answers 404 for a non-member', async () => {
		stub(250, undefined, false);

		await expect(listOrgPeople('u1', ORG, 1)).rejects.toMatchObject({ status: 404 });
	});

	it('counts and pages within the org', async () => {
		await listOrgPeople('u1', ORG, 3);

		expect(flat(sqlRun('COUNT(*)')![0])).toContain('universe.org_person');
		expect(sqlRun('COUNT(*)')![1]).toEqual([ORG]);
		expect(sqlRun('LIMIT $2 OFFSET $3')![1]).toEqual([ORG, 100, 200]);
	});

	it('clamps a page past the end', async () => {
		expect((await listOrgPeople('u1', ORG, 99)).page).toBe(3);
	});

	it('orders with an id tiebreak, so pages cannot repeat or skip a row', async () => {
		await listOrgPeople('u1', ORG, 1);

		expect(flat(sqlRun('LIMIT $2 OFFSET $3')![0])).toContain(
			'ORDER BY last_name NULLS LAST, first_name NULLS LAST, id LIMIT'
		);
	});
});

describe('current versions only', () => {
	it('leaves superseded versions out of the count and the page', async () => {
		await listOrgPeople('u1', ORG, 1);

		expect(flat(sqlRun('COUNT(*)')![0])).toContain('valid_to IS NULL');
		expect(flat(sqlRun('LIMIT $2 OFFSET $3')![0])).toContain('valid_to IS NULL');
	});
});

describe('getPerson', () => {
	const PERSON = 'c1b2c3d4-e5f6-7890-abcd-ef1234567890';

	it('answers 403 without staff access and reads no person', async () => {
		canOrg.mockResolvedValue(false);

		await expect(getPerson('u1', ORG, PERSON)).rejects.toMatchObject({ status: 403 });
		expect(sqlRun('FROM universe.org_person')).toBeUndefined();
	});

	it("reads the person's current version in the org", async () => {
		stub(0, () => ({ rowCount: 1, rows: [{ id: PERSON, first_name: 'Ada' }] }));

		expect(await getPerson('u1', ORG, PERSON)).toMatchObject({ first_name: 'Ada' });
		const [sql, values] = sqlRun('FROM universe.org_person')!;
		expect(flat(sql)).toContain('valid_to IS NULL');
		expect(values).toEqual([PERSON, ORG]);
	});

	it('answers 404 when there is no such current person', async () => {
		stub(0, () => ({ rowCount: 0, rows: [] }));

		await expect(getPerson('u1', ORG, PERSON)).rejects.toMatchObject({ status: 404 });
	});
});

describe('importPeopleCsv', () => {
	const csv = [
		'first_name,last_name,dob,email',
		'Ada,Lovelace,1815-12-10,ada@x.org',
		'Bad,Date,12/10/1815,',
		'Grace,Hopper,,'
	].join('\n');

	it('answers 403 without staff access and adds no one', async () => {
		canOrg.mockResolvedValue(false);

		await expect(importPeopleCsv('u1', ORG, csv)).rejects.toMatchObject({ status: 403 });
		expect(sqlRun('INSERT INTO universe.org_person')).toBeUndefined();
	});

	it('adds the valid rows and reports the invalid ones by row number', async () => {
		stub(0, () => ({ rowCount: 1, rows: [{ id: 'e1' }] }));

		const result = await importPeopleCsv('u1', ORG, csv);

		expect(result).toEqual({
			imported: 2,
			skipped: 1,
			errors: [{ row: 2, reason: 'dob must be in YYYY-MM-DD format' }]
		});
		const inserts = mockClient.query.mock.calls.filter((c) =>
			String(c[0]).includes('INSERT INTO universe.org_person')
		);
		expect(inserts).toHaveLength(2);
		// Empty cells are stored as null, and the importer is the author.
		expect(inserts[1][1]).toEqual([
			ORG,
			'e1',
			'Grace',
			null,
			'Hopper',
			null,
			null,
			null,
			null,
			null,
			null,
			'u1'
		]);
	});

	it('opens no transaction when no row is valid', async () => {
		await importPeopleCsv('u1', ORG, 'first_name,dob\nBad,nope');

		expect(sqlRun('INSERT INTO universe.org_entity')).toBeUndefined();
	});
});
