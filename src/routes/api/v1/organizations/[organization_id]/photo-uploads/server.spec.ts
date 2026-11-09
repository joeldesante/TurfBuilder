import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

const mocks = vi.hoisted(() => ({ createPhotoUpload: vi.fn() }));

vi.mock('$lib/server/services/photos.service', () => ({
	createPhotoUpload: mocks.createPhotoUpload,
	PhotoUploadSchema: z.object({
		contentType: z.enum(['image/jpeg', 'image/webp', 'image/png']),
		contentLength: z.number().int().positive().max(5_000_000)
	})
}));

import { POST } from './+server';

const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const body = { contentType: 'image/webp', contentLength: 120_000 };

function call(payload: unknown, locals: unknown = { user: { id: 'u1' } }, id = ORG) {
	const request = new Request('http://localhost/api/v1/organizations/x/photo-uploads', {
		method: 'POST',
		body: JSON.stringify(payload)
	});
	return Promise.resolve().then(() =>
		POST({ params: { organization_id: id }, locals, request } as never)
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.createPhotoUpload.mockResolvedValue({ url: 'https://signed.example/put', key: 'k' });
});

describe('POST /api/v1/organizations/[organization_id]/photo-uploads', () => {
	it('answers 401 when signed out', async () => {
		await expect(call(body, { user: null })).rejects.toMatchObject({ status: 401 });
	});

	it('answers 400 for an id that is not an id', async () => {
		await expect(call(body, undefined, 'acme')).rejects.toMatchObject({ status: 400 });
	});

	it('answers 400 for a file that is not an image, and signs nothing', async () => {
		await expect(call({ ...body, contentType: 'application/pdf' })).rejects.toMatchObject({
			status: 400
		});
		expect(mocks.createPhotoUpload).not.toHaveBeenCalled();
	});

	it('answers 201 with the upload link and the key', async () => {
		const response = await call(body);

		expect(response.status).toBe(201);
		expect(await response.json()).toEqual({ url: 'https://signed.example/put', key: 'k' });
		expect(mocks.createPhotoUpload).toHaveBeenCalledWith('u1', ORG, body);
	});
});
