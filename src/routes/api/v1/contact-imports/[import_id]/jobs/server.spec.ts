import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

const mocks = vi.hoisted(() => ({ startContactImportJob: vi.fn() }));

vi.mock('$lib/server/services/contact-import-jobs.service', () => ({
	startContactImportJob: mocks.startContactImportJob,
	StartContactImportJobSchema: z.object({
		schemaId: z.uuid(),
		mapping: z.record(z.string(), z.number().int().min(0))
	})
}));

import { POST } from './+server';

const IMPORT = '3f1c2b9e-0000-4000-8000-000000000001';
const SCHEMA = '3f1c2b9e-0000-4000-8000-000000000002';
const body = { schemaId: SCHEMA, mapping: { 'contact.latitude': 3 } };

function call(payload: unknown, locals: unknown = { user: { id: 'u1' } }, id = IMPORT) {
	const request = new Request('http://localhost/api/v1/contact-imports/x/jobs', {
		method: 'POST',
		body: JSON.stringify(payload)
	});
	return Promise.resolve().then(() =>
		POST({ params: { import_id: id }, locals, request } as never)
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.startContactImportJob.mockResolvedValue({ id: 'j1', status: 'queued' });
});

describe('POST /api/v1/contact-imports/[import_id]/jobs', () => {
	it('answers 401 when signed out', async () => {
		await expect(call(body, { user: null })).rejects.toMatchObject({ status: 401 });
	});

	it('answers 400 for an id that is not an id', async () => {
		await expect(call(body, undefined, 'nope')).rejects.toMatchObject({ status: 400 });
	});

	it('answers 400 for a body without a schema, and starts nothing', async () => {
		await expect(call({ mapping: {} })).rejects.toMatchObject({ status: 400 });
		expect(mocks.startContactImportJob).not.toHaveBeenCalled();
	});

	it('answers 400 for a column that is not a whole number', async () => {
		await expect(call({ ...body, mapping: { a: -1 } })).rejects.toMatchObject({ status: 400 });
		expect(mocks.startContactImportJob).not.toHaveBeenCalled();
	});

	it('answers 201 with the queued job', async () => {
		const response = await call(body);

		expect(response.status).toBe(201);
		expect(await response.json()).toEqual({ id: 'j1', status: 'queued' });
		expect(mocks.startContactImportJob).toHaveBeenCalledWith('u1', IMPORT, body);
	});
});
