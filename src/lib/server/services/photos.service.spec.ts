import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
	class StorageNotConfiguredError extends Error {}
	return {
		requireActiveMembership: vi.fn(),
		presignPhotoUpload: vi.fn(),
		presignPhotoDownload: vi.fn(),
		StorageNotConfiguredError,
		warn: vi.fn()
	};
});

vi.mock('$lib/server/list-access', () => ({
	requireActiveMembership: mocks.requireActiveMembership
}));
vi.mock('$lib/server/storage', () => ({
	ALLOWED_PHOTO_TYPES: ['image/jpeg', 'image/webp', 'image/png'],
	presignPhotoUpload: mocks.presignPhotoUpload,
	presignPhotoDownload: mocks.presignPhotoDownload,
	StorageNotConfiguredError: mocks.StorageNotConfiguredError
}));
vi.mock('$lib/server/logger', () => ({ logger: { warn: mocks.warn } }));

import { createPhotoUpload, getPhotoUrl, PhotoUploadSchema } from './photos.service';

const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const KEY = `orgs/${ORG}/locations/3f1c2b9e-0000-4000-8000-000000000001.webp`;
const input = { contentType: 'image/webp' as const, contentLength: 120_000 };

beforeEach(() => {
	vi.clearAllMocks();
	mocks.requireActiveMembership.mockResolvedValue({ role: 'member' });
	mocks.presignPhotoUpload.mockResolvedValue({ url: 'https://signed.example/put', key: KEY });
	mocks.presignPhotoDownload.mockResolvedValue('https://signed.example/get');
});

describe('PhotoUploadSchema', () => {
	it('accepts an image within the size cap', () => {
		expect(PhotoUploadSchema.safeParse(input).success).toBe(true);
	});

	it.each([
		['a type that is not an image', { ...input, contentType: 'application/pdf' }],
		['a size over the cap', { ...input, contentLength: 9_000_000 }],
		['a size of zero', { ...input, contentLength: 0 }]
	])('refuses %s', (_name, body) => {
		expect(PhotoUploadSchema.safeParse(body).success).toBe(false);
	});
});

describe('createPhotoUpload', () => {
	// Volunteers attach photos and hold no staff permission, so membership
	// alone has to be enough.
	it('signs an upload for a member of the org', async () => {
		expect(await createPhotoUpload('u1', ORG, input)).toEqual({
			url: 'https://signed.example/put',
			key: KEY
		});
		expect(mocks.requireActiveMembership).toHaveBeenCalledWith('u1', ORG);
		expect(mocks.presignPhotoUpload).toHaveBeenCalledWith(ORG, 'image/webp', 120_000);
	});

	it('signs nothing for someone who is not a member', async () => {
		mocks.requireActiveMembership.mockRejectedValue({ status: 404 });

		await expect(createPhotoUpload('u1', ORG, input)).rejects.toMatchObject({ status: 404 });
		expect(mocks.presignPhotoUpload).not.toHaveBeenCalled();
	});

	it('answers 503 when storage is not set up', async () => {
		mocks.presignPhotoUpload.mockRejectedValue(
			new mocks.StorageNotConfiguredError('Storage is not set up.')
		);

		await expect(createPhotoUpload('u1', ORG, input)).rejects.toMatchObject({
			status: 503,
			body: { message: 'Storage is not set up.' }
		});
	});
});

describe('getPhotoUrl', () => {
	it('links a photo for a member of the org its key names', async () => {
		expect(await getPhotoUrl('u1', KEY)).toBe('https://signed.example/get');
		expect(mocks.requireActiveMembership).toHaveBeenCalledWith('u1', ORG);
		expect(mocks.presignPhotoDownload).toHaveBeenCalledWith(KEY);
	});

	it('answers 404 when the caller is not a member of that org', async () => {
		mocks.requireActiveMembership.mockRejectedValue({ status: 404 });

		await expect(getPhotoUrl('u1', KEY)).rejects.toMatchObject({ status: 404 });
		expect(mocks.presignPhotoDownload).not.toHaveBeenCalled();
	});

	it('keeps the 403 of a suspended org', async () => {
		mocks.requireActiveMembership.mockRejectedValue({ status: 403 });

		await expect(getPhotoUrl('u1', KEY)).rejects.toMatchObject({ status: 403 });
	});

	it.each([
		['a list document', `orgs/${ORG}/lists/l1/documents/d1.pdf`],
		['a key outside any org', 'locations/a.webp'],
		['a path that climbs out of the folder', `orgs/${ORG}/locations/../lists/a.pdf`],
		['an org id that is not an id', 'orgs/acme/locations/a.webp']
	])('answers 404 for %s without checking membership', async (_name, key) => {
		await expect(getPhotoUrl('u1', key)).rejects.toMatchObject({ status: 404 });
		expect(mocks.requireActiveMembership).not.toHaveBeenCalled();
		expect(mocks.presignPhotoDownload).not.toHaveBeenCalled();
	});

	it('answers 503 when storage is not set up', async () => {
		mocks.presignPhotoDownload.mockRejectedValue(
			new mocks.StorageNotConfiguredError('Storage is not set up.')
		);

		await expect(getPhotoUrl('u1', KEY)).rejects.toMatchObject({ status: 503 });
	});
});
