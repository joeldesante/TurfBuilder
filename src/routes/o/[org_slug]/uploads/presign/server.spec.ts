import { describe, it, expect, vi, beforeEach } from 'vitest';

const { presignPhotoUpload, StorageNotConfiguredError } = vi.hoisted(() => {
	class StorageNotConfiguredError extends Error {}
	return { presignPhotoUpload: vi.fn(), StorageNotConfiguredError };
});

vi.mock('$lib/server/storage.js', () => ({
	presignPhotoUpload,
	StorageNotConfiguredError,
	ALLOWED_PHOTO_TYPES: ['image/jpeg', 'image/webp', 'image/png']
}));

import { POST } from './+server';

const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const member = { user: { id: 'u1' }, organization: { id: ORG, permissions: [] } };

function makeRequest(payload: unknown) {
	return { json: () => Promise.resolve(payload) } as never;
}

const body = { contentType: 'image/webp', contentLength: 120_000 };

beforeEach(() => {
	vi.clearAllMocks();
	presignPhotoUpload.mockResolvedValue({ url: 'https://signed.example/put', key: 'orgs/x/y.webp' });
});

describe('POST /o/[org_slug]/uploads/presign', () => {
	it('rejects a signed-out caller', async () => {
		const response = await POST({
			request: makeRequest(body),
			locals: { user: null, organization: null }
		} as never);

		expect(response.status).toBe(401);
	});

	it('rejects a caller with no organization', async () => {
		const response = await POST({
			request: makeRequest(body),
			locals: { user: { id: 'u1' }, organization: null }
		} as never);

		expect(response.status).toBe(401);
	});

	// Volunteers attach photos and hold no staff permission, so org membership
	// alone has to be enough here.
	it('allows an org member holding no permissions', async () => {
		const response = await POST({ request: makeRequest(body), locals: member } as never);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			url: 'https://signed.example/put',
			key: 'orgs/x/y.webp'
		});
	});

	it('signs against the caller org', async () => {
		await POST({ request: makeRequest(body), locals: member } as never);

		expect(presignPhotoUpload).toHaveBeenCalledWith(ORG, 'image/webp', 120_000);
	});

	it('rejects a content type that is not an image', async () => {
		const response = await POST({
			request: makeRequest({ ...body, contentType: 'application/pdf' }),
			locals: member
		} as never);

		expect(response.status).toBe(400);
		expect(presignPhotoUpload).not.toHaveBeenCalled();
	});

	it('rejects an upload over the size cap', async () => {
		const response = await POST({
			request: makeRequest({ ...body, contentLength: 9_000_000 }),
			locals: member
		} as never);

		expect(response.status).toBe(400);
	});

	it('rejects a non-positive size', async () => {
		const response = await POST({
			request: makeRequest({ ...body, contentLength: 0 }),
			locals: member
		} as never);

		expect(response.status).toBe(400);
	});

	it('reports unconfigured storage as 503 rather than crashing', async () => {
		presignPhotoUpload.mockRejectedValue(new StorageNotConfiguredError('not configured'));

		const response = await POST({ request: makeRequest(body), locals: member } as never);

		expect(response.status).toBe(503);
	});
});
