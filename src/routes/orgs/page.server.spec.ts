import { describe, it, expect, vi, beforeEach } from 'vitest';

const { isOrgCreationAllowed } = vi.hoisted(() => ({ isOrgCreationAllowed: vi.fn() }));
vi.mock('$lib/server/services/organizations.service', () => ({ isOrgCreationAllowed }));

import { load } from './+page.server';

beforeEach(() => vi.clearAllMocks());

describe('orgs page load', () => {
	it('says whether people may create organizations', async () => {
		isOrgCreationAllowed.mockResolvedValue(true);
		expect(await load()).toEqual({ allowCreation: true });

		isOrgCreationAllowed.mockResolvedValue(false);
		expect(await load()).toEqual({ allowCreation: false });
	});
});
