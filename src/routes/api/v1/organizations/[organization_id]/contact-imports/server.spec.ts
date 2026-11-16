import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

const mocks = vi.hoisted(() => ({
	createContactImportUpload: vi.fn(),
	listContactImports: vi.fn()
}));

vi.mock('$lib/server/services/contact-imports.service', () => ({
	createContactImportUpload: mocks.createContactImportUpload,
	listContactImports: mocks.listContactImports,
	ContactImportUploadSchema: z.object({
		fileName: z.string().trim().min(1).max(255),
		contentLength: z.number().int().positive().max(50_000_000)
	})
}));

import { GET, POST } from './+server';

const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const body = { fileName: 'people.csv', contentLength: 120_000 };

function call(payload: unknown, locals: unknown = { user: { id: 'u1' } }, id = ORG) {
	const request = new Request('http://localhost/api/v1/organizations/x/contact-imports', {
		method: 'POST',
		body: JSON.stringify(payload)
	});
	return Promise.resolve().then(() =>
		POST({ params: { organization_id: id }, locals, request } as never)
	);
}

function list(locals: unknown = { user: { id: 'u1' } }, id = ORG) {
	return Promise.resolve().then(() => GET({ params: { organization_id: id }, locals } as never));
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.createContactImportUpload.mockResolvedValue({
		id: 'i1',
		url: 'https://signed.example/put',
		key: 'k'
	});
	mocks.listContactImports.mockResolvedValue([{ id: 'i1' }]);
});

describe('POST /api/v1/organizations/[organization_id]/contact-imports', () => {
	it('answers 401 when signed out', async () => {
		await expect(call(body, { user: null })).rejects.toMatchObject({ status: 401 });
	});

	it('answers 400 for an id that is not an id', async () => {
		await expect(call(body, undefined, 'acme')).rejects.toMatchObject({ status: 400 });
	});

	it('answers 400 for a file that is too large, and signs nothing', async () => {
		await expect(call({ ...body, contentLength: 90_000_000 })).rejects.toMatchObject({
			status: 400
		});
		expect(mocks.createContactImportUpload).not.toHaveBeenCalled();
	});

	it('answers 400 for a missing file name', async () => {
		await expect(call({ contentLength: 100 })).rejects.toMatchObject({ status: 400 });
	});

	it('answers 201 with the id, the upload link and the key', async () => {
		const response = await call(body);

		expect(response.status).toBe(201);
		expect(await response.json()).toEqual({
			id: 'i1',
			url: 'https://signed.example/put',
			key: 'k'
		});
		expect(mocks.createContactImportUpload).toHaveBeenCalledWith('u1', ORG, body);
	});
});

describe('GET /api/v1/organizations/[organization_id]/contact-imports', () => {
	it('answers 401 when signed out', async () => {
		await expect(list({ user: null })).rejects.toMatchObject({ status: 401 });
	});

	it('answers 400 for an id that is not an id', async () => {
		await expect(list(undefined, 'acme')).rejects.toMatchObject({ status: 400 });
	});

	it('answers the list', async () => {
		const response = await list();

		expect(await response.json()).toEqual([{ id: 'i1' }]);
		expect(mocks.listContactImports).toHaveBeenCalledWith('u1', ORG);
	});
});
