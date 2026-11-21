import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ listContactImportJobs: vi.fn() }));

vi.mock('$lib/server/services/contact-import-jobs.service', () => ({
	listContactImportJobs: mocks.listContactImportJobs
}));

import { GET } from './+server';

const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

function call(locals: unknown = { user: { id: 'u1' } }, id = ORG) {
	return Promise.resolve().then(() => GET({ params: { organization_id: id }, locals } as never));
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.listContactImportJobs.mockResolvedValue([{ id: 'j1' }]);
});

describe('GET /api/v1/organizations/[organization_id]/contact-import-jobs', () => {
	it('answers 401 when signed out', async () => {
		await expect(call({ user: null })).rejects.toMatchObject({ status: 401 });
	});

	it('answers 400 for an id that is not an id', async () => {
		await expect(call(undefined, 'nope')).rejects.toMatchObject({ status: 400 });
	});

	it('answers the jobs', async () => {
		const response = await call();

		expect(await response.json()).toEqual([{ id: 'j1' }]);
		expect(mocks.listContactImportJobs).toHaveBeenCalledWith('u1', ORG);
	});
});
