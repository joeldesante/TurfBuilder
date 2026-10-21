import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: { DATABASE_URL: 'postgresql://test:test@localhost/test' } }));

const mocks = vi.hoisted(() => ({
	pool: { query: vi.fn() },
	requireInfraPermission: vi.fn(),
	audit: vi.fn(),
	infraImpersonateUser: vi.fn()
}));

vi.mock('$lib/server/database', () => ({ POOL: mocks.pool }));
vi.mock('$lib/server/permissions', () => ({ requireInfraPermission: mocks.requireInfraPermission }));
vi.mock('./audit.service', () => ({ audit: mocks.audit }));
vi.mock('$lib/auth', () => ({ getAuth: async () => ({ api: { infraImpersonateUser: mocks.infraImpersonateUser } }) }));

import { startImpersonation } from './impersonation.service';

const ADMIN = '11111111-1111-4111-8111-111111111111';
const TARGET = '22222222-2222-4222-8222-222222222222';

beforeEach(() => {
	vi.clearAllMocks();
	mocks.requireInfraPermission.mockResolvedValue(undefined);
	mocks.pool.query.mockResolvedValue({ rowCount: 1, rows: [{ name: 'Grace', email: 'grace@example.org', deleted_at: null }] });
	mocks.infraImpersonateUser.mockResolvedValue({ sessionId: 'sess-1', userId: TARGET, expiresAt: new Date('2026-10-21T12:00:00Z') });
});

describe('startImpersonation', () => {
	it('records the start', async () => {
		await startImpersonation(ADMIN, TARGET, new Headers());

		expect(mocks.audit).toHaveBeenCalledWith(ADMIN, 'user.impersonate.start', { type: 'user', id: TARGET }, expect.anything());
	});

	it('ends the new session when the start cannot be recorded', async () => {
		mocks.audit.mockRejectedValue(new Error('db down'));

		await expect(startImpersonation(ADMIN, TARGET, new Headers())).rejects.toThrow('db down');
		expect(mocks.pool.query).toHaveBeenCalledWith('DELETE FROM auth.session WHERE id = $1', ['sess-1']);
	});

	it('refuses a deleted account before starting anything', async () => {
		mocks.pool.query.mockResolvedValue({ rowCount: 1, rows: [{ name: 'x', email: 'x', deleted_at: new Date() }] });

		await expect(startImpersonation(ADMIN, TARGET, new Headers())).rejects.toMatchObject({ status: 409 });
		expect(mocks.infraImpersonateUser).not.toHaveBeenCalled();
	});
});
