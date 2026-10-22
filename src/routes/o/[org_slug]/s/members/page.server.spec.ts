import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { DATABASE_URL: 'postgresql://test:test@localhost/test' }
}));

// Hoisted so the mock factory, which vitest lifts above this file's consts,
// can still reach it.
const { mockClient } = vi.hoisted(() => ({
	mockClient: { query: vi.fn(), release: vi.fn() }
}));

vi.mock('pg', () => ({
	Pool: vi.fn(function () {
		return {
			connect: vi.fn().mockResolvedValue(mockClient),
			// members' load() also queries invite links directly via POOL.query.
			query: vi.fn().mockResolvedValue({ rows: [] }),
			on: vi.fn(),
			end: vi.fn()
		};
	})
}));

import { load } from './+page.server';

const ownerLocals = {
	user: { id: 'u1' },
	organization: {
		id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
		role: { id: 'r1', name: 'Owner' },
		permissions: ['member.read', 'member.delete', 'member.update', 'member.invite']
	}
};

const staffLocals = {
	user: { id: 'u2' },
	organization: {
		id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
		role: { id: 'r2', name: 'Staff' },
		permissions: ['member.read']
	}
};

const noPermLocals = {
	user: { id: 'u3' },
	organization: {
		id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
		role: { id: 'r3', name: 'No Access' },
		permissions: []
	}
};

/** Answers the member count with `count` and every other query with `rows`. */
function answer(rows: unknown[] = [], count = rows.length) {
	mockClient.query.mockImplementation(async (sql: string) =>
		String(sql).includes('COUNT(*)') ? { rows: [{ count: String(count) }] } : { rows }
	);
}

function event(locals: unknown, page?: string) {
	const url = new URL('https://x/o/acme/s/members');
	if (page !== undefined) url.searchParams.set('page', page);
	return { locals, url } as unknown as Parameters<typeof load>[0];
}

/** Parameters of the paged member SELECT: [orgId, limit, offset]. */
function pageParams() {
	return mockClient.query.mock.calls.find((c) => String(c[0]).includes('LIMIT $3 OFFSET $4'))![1];
}

beforeEach(() => {
	vi.clearAllMocks();
	answer();
});

describe('members page load', () => {
	it('throws 403 when caller lacks member:read', async () => {
		await expect(load(event(noPermLocals))).rejects.toMatchObject({ status: 403 });
	});

	it('returns members array for authorized user', async () => {
		const members = [{ id: 'u1', name: 'Alice', email: 'a@b.com', role_id: null, role_name: null }];
		mockClient.query.mockImplementation(async (sql: string) => {
			if (String(sql).includes('COUNT(*)')) return { rows: [{ count: '1' }] };
			return String(sql).includes('FROM auth.member') ? { rows: members } : { rows: [] };
		});

		const result = await load(event(staffLocals));
		expect(result.members).toEqual(members);
	});

	it('includes canRemoveMembers based on permissions', async () => {
		const result = await load(event(staffLocals));
		// staffLocals has member:read but not member:delete
		expect(result.canRemoveMembers).toBe(false);
	});

	it('resolves for owner locals', async () => {
		const result = await load(event(ownerLocals));
		expect(result.members).toEqual([]);
	});

	it('releases the db client', async () => {
		await load(event(staffLocals));
		expect(mockClient.release).toHaveBeenCalledTimes(1);
	});

	it('returns the total and the first page by default', async () => {
		answer([], 250);

		const result = await load(event(staffLocals));

		expect(result).toMatchObject({ totalCount: 250, page: 1, pageSize: 100 });
		expect(pageParams()).toEqual([staffLocals.organization.id, null, 100, 0]);
	});

	it('offsets by whole pages and clamps past the end', async () => {
		answer([], 250);

		const result = await load(event(staffLocals, '9'));

		expect(result.page).toBe(3);
		expect(pageParams()).toEqual([staffLocals.organization.id, null, 100, 200]);
	});

	it('orders by name with an id tiebreak, so pages cannot repeat or skip a member', async () => {
		await load(event(staffLocals, '2'));

		const sql = String(
			mockClient.query.mock.calls.find((c) => String(c[0]).includes('LIMIT $3 OFFSET $4'))![0]
		).replace(/\s+/g, ' ');
		expect(sql).toContain('ORDER BY lower(name), id LIMIT $3 OFFSET $4');
	});
});
