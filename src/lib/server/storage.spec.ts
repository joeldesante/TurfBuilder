import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: {
		DATABASE_URL: 'postgresql://test:test@localhost/test',
		SPACES_ACCESS_KEY_ID: 'key',
		SPACES_SECRET_ACCESS_KEY: 'secret'
	}
}));

const { poolQuery } = vi.hoisted(() => ({ poolQuery: vi.fn() }));

// A function expression, not an arrow: the Pool mock is called with `new`.
vi.mock('pg', () => ({
	Pool: vi.fn(function () {
		return {
			query: poolQuery,
			connect: vi.fn(),
			on: vi.fn(),
			end: vi.fn()
		};
	})
}));

const { getSignedUrl } = vi.hoisted(() => ({
	getSignedUrl: vi.fn().mockResolvedValue('https://signed.example/put')
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl }));

vi.mock('@aws-sdk/client-s3', () => ({
	S3Client: vi.fn(function (config: unknown) {
		return { config };
	}),
	PutObjectCommand: vi.fn(function (input: unknown) {
		return { input };
	}),
	GetObjectCommand: vi.fn(function (input: unknown) {
		return { input };
	})
}));

import { PutObjectCommand } from '@aws-sdk/client-s3';
import {
	presignPhotoUpload,
	presignPhotoDownload,
	locationPhotoKey,
	keyBelongsToOrg,
	StorageNotConfiguredError
} from './storage';

const ORG = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

function stubSettings(rows: { key: string; value: string }[]) {
	poolQuery.mockResolvedValue({ rows });
}

const configured = [
	{ key: 'spaces.endpoint', value: 'https://nyc3.digitaloceanspaces.com' },
	{ key: 'spaces.region', value: 'nyc3' },
	{ key: 'spaces.bucket', value: 'deice-photos' }
];

beforeEach(() => {
	vi.clearAllMocks();
	getSignedUrl.mockResolvedValue('https://signed.example/put');
	stubSettings(configured);
});

describe('locationPhotoKey', () => {
	it('prefixes the key with the org id', () => {
		expect(locationPhotoKey(ORG, 'image/jpeg')).toMatch(new RegExp(`^orgs/${ORG}/locations/`));
	});

	it('uses the extension matching the content type', () => {
		expect(locationPhotoKey(ORG, 'image/jpeg')).toMatch(/\.jpg$/);
		expect(locationPhotoKey(ORG, 'image/webp')).toMatch(/\.webp$/);
		expect(locationPhotoKey(ORG, 'image/png')).toMatch(/\.png$/);
	});

	// Nothing the client sends contributes to the key, so it cannot be guessed.
	it('produces a distinct key each call', () => {
		expect(locationPhotoKey(ORG, 'image/jpeg')).not.toBe(locationPhotoKey(ORG, 'image/jpeg'));
	});
});

describe('keyBelongsToOrg', () => {
	it('accepts a key under the org prefix', () => {
		expect(keyBelongsToOrg(`orgs/${ORG}/locations/abc.jpg`, ORG)).toBe(true);
	});

	it('rejects another org key', () => {
		expect(keyBelongsToOrg('orgs/other-org/locations/abc.jpg', ORG)).toBe(false);
	});

	it('rejects a traversal attempt', () => {
		expect(keyBelongsToOrg(`../orgs/${ORG}/locations/abc.jpg`, ORG)).toBe(false);
	});
});

describe('presignPhotoUpload', () => {
	it('returns the signed url and the generated key', async () => {
		const result = await presignPhotoUpload(ORG, 'image/webp', 120_000);

		expect(result.url).toBe('https://signed.example/put');
		expect(result.key).toMatch(new RegExp(`^orgs/${ORG}/locations/`));
	});

	// Pinning both into the signature stops a client presenting a small image
	// for signing and then uploading something else.
	it('binds the content type and length into the signature', async () => {
		await presignPhotoUpload(ORG, 'image/webp', 120_000);

		expect(PutObjectCommand).toHaveBeenCalledWith(
			expect.objectContaining({
				Bucket: 'deice-photos',
				ContentType: 'image/webp',
				ContentLength: 120_000
			})
		);
	});

	it('gives the url a short expiry', async () => {
		await presignPhotoUpload(ORG, 'image/jpeg', 1000);

		expect(getSignedUrl).toHaveBeenCalledWith(
			expect.anything(),
			expect.anything(),
			expect.objectContaining({ expiresIn: 300 })
		);
	});

	it('throws when no bucket is configured', async () => {
		stubSettings([{ key: 'spaces.endpoint', value: 'https://nyc3.digitaloceanspaces.com' }]);

		await expect(presignPhotoUpload(ORG, 'image/jpeg', 1000)).rejects.toThrow(
			StorageNotConfiguredError
		);
	});

	it('throws when no endpoint is configured', async () => {
		stubSettings([{ key: 'spaces.bucket', value: 'deice-photos' }]);

		await expect(presignPhotoUpload(ORG, 'image/jpeg', 1000)).rejects.toThrow(
			StorageNotConfiguredError
		);
	});
});

describe('presignPhotoDownload', () => {
	it('signs a get for the requested key', async () => {
		getSignedUrl.mockResolvedValue('https://signed.example/get');

		await expect(presignPhotoDownload(`orgs/${ORG}/locations/abc.jpg`)).resolves.toBe(
			'https://signed.example/get'
		);
	});
});
