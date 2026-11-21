import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PoolClient } from 'pg';

const m = vi.hoisted(() => ({ canOrg: vi.fn() }));

vi.mock('$lib/server/permissions', () => ({ canOrg: m.canOrg }));

import { requirePermission } from './require-permission';

const client = {} as PoolClient;

describe('requirePermission', () => {
	beforeEach(() => {
		m.canOrg.mockReset();
	});

	it('resolves when the user holds the permission', async () => {
		m.canOrg.mockResolvedValue(true);

		await expect(
			requirePermission(client, 'user-1', 'org-1', 'role.read')
		).resolves.toBeUndefined();
		expect(m.canOrg).toHaveBeenCalledWith(client, 'user-1', 'org-1', 'role.read');
	});

	it('throws 403 when the user does not', async () => {
		m.canOrg.mockResolvedValue(false);

		await expect(requirePermission(client, 'user-1', 'org-1', 'role.read')).rejects.toMatchObject({
			status: 403
		});
	});
});
