import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ getContactImportJob: vi.fn() }));

vi.mock('$lib/server/services/contact-import-jobs.service', () => ({
	getContactImportJob: mocks.getContactImportJob
}));

import { GET } from './+server';

const JOB = '3f1c2b9e-0000-4000-8000-000000000003';

function call(locals: unknown = { user: { id: 'u1' } }, id = JOB) {
	return Promise.resolve().then(() => GET({ params: { job_id: id }, locals } as never));
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.getContactImportJob.mockResolvedValue({ id: JOB, rows_processed: 500 });
});

describe('GET /api/v1/contact-import-jobs/[job_id]', () => {
	it('answers 401 when signed out', async () => {
		await expect(call({ user: null })).rejects.toMatchObject({ status: 401 });
	});

	it('answers 400 for an id that is not an id', async () => {
		await expect(call(undefined, 'nope')).rejects.toMatchObject({ status: 400 });
	});

	it('answers the job', async () => {
		const response = await call();

		expect(await response.json()).toEqual({ id: JOB, rows_processed: 500 });
		expect(mocks.getContactImportJob).toHaveBeenCalledWith('u1', JOB);
	});
});
