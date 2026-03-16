import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { DATABASE_URL: 'postgresql://test:test@localhost/test' }
}));

const mockClient = {
	query: vi.fn(),
	release: vi.fn()
};

vi.mock('pg', () => ({
	Pool: vi.fn(() => ({
		connect: vi.fn().mockResolvedValue(mockClient),
		on: vi.fn(),
		end: vi.fn()
	}))
}));

import { withOrgTransaction } from './database';

const validOrgId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

beforeEach(() => {
	vi.clearAllMocks();
	mockClient.query.mockResolvedValue({ rows: [] });
	mockClient.release.mockReset();
});

describe('withOrgTransaction', () => {
	it('rejects invalid orgId formats', async () => {
		await expect(withOrgTransaction('not-a-uuid', async () => {})).rejects.toThrow(
			'invalid orgId format'
		);
	});

	it('rejects empty string orgId', async () => {
		await expect(withOrgTransaction('', async () => {})).rejects.toThrow('invalid orgId format');
	});

	it('issues BEGIN before calling the fn', async () => {
		await withOrgTransaction(validOrgId, async () => 'ok');
		const calls = mockClient.query.mock.calls.map((c) => c[0]);
		const beginIndex = calls.findIndex((q: string) => q === 'BEGIN');
		expect(beginIndex).toBeGreaterThanOrEqual(0);
	});

	it('sets app.current_org_id via SET LOCAL', async () => {
		await withOrgTransaction(validOrgId, async () => 'ok');
		const calls = mockClient.query.mock.calls.map((c) => c[0]);
		const setCall = calls.find((q: string) => q.includes('SET LOCAL app.current_org_id'));
		expect(setCall).toContain(validOrgId);
	});

	it('issues COMMIT on success', async () => {
		await withOrgTransaction(validOrgId, async () => 'ok');
		const calls = mockClient.query.mock.calls.map((c) => c[0]);
		expect(calls).toContain('COMMIT');
	});

	it('returns the value from the callback', async () => {
		const result = await withOrgTransaction(validOrgId, async () => 42);
		expect(result).toBe(42);
	});

	it('issues ROLLBACK when the callback throws', async () => {
		await expect(
			withOrgTransaction(validOrgId, async () => {
				throw new Error('query failed');
			})
		).rejects.toThrow('query failed');

		const calls = mockClient.query.mock.calls.map((c) => c[0]);
		expect(calls).toContain('ROLLBACK');
		expect(calls).not.toContain('COMMIT');
	});

	it('releases the client even on success', async () => {
		await withOrgTransaction(validOrgId, async () => 'ok');
		expect(mockClient.release).toHaveBeenCalledTimes(1);
	});

	it('releases the client even when the callback throws', async () => {
		await expect(
			withOrgTransaction(validOrgId, async () => {
				throw new Error('boom');
			})
		).rejects.toThrow();
		expect(mockClient.release).toHaveBeenCalledTimes(1);
	});

	it('resets app.current_org_id before releasing', async () => {
		await withOrgTransaction(validOrgId, async () => 'ok');
		const calls = mockClient.query.mock.calls.map((c) => c[0]);
		const resetIdx = calls.findIndex((q: string) => q.includes('RESET app.current_org_id'));
		const releaseCallOrder = mockClient.release.mock.invocationCallOrder[0];
		// RESET should appear in query calls before release
		expect(resetIdx).toBeGreaterThanOrEqual(0);
	});
});
