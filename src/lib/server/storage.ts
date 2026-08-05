import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '$env/dynamic/private';
import { POOL } from '$lib/server/database';

/**
 * Object storage for location photos, backed by DigitalOcean Spaces.
 *
 * Endpoint, region, and bucket are runtime settings so an instance can be
 * pointed at a different bucket without a redeploy; credentials come from the
 * environment and are never stored in the database. This mirrors how
 * $lib/server/mail.ts splits its configuration.
 *
 * Uploads never pass through this server: the browser is handed a presigned
 * PUT and writes straight to the bucket, which keeps multi-megabyte phone
 * photos off the app server and survives flaky field connections better.
 */

export interface SpacesSettings {
	endpoint: string;
	region: string;
	bucket: string;
}

/** How long a presigned URL stays valid. Long enough for a slow phone upload. */
const SIGNED_URL_TTL_SECONDS = 300;

export const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/webp', 'image/png'] as const;

const EXTENSIONS: Record<string, string> = {
	'image/jpeg': 'jpg',
	'image/webp': 'webp',
	'image/png': 'png'
};

export class StorageNotConfiguredError extends Error {
	constructor() {
		super('Object storage is not configured. Set it up in infrastructure settings.');
		this.name = 'StorageNotConfiguredError';
	}
}

async function loadSpacesSettings(): Promise<SpacesSettings> {
	const result = await POOL.query<{ key: string; value: string }>(
		`SELECT key, value FROM system_setting WHERE key IN (
			'spaces.endpoint', 'spaces.region', 'spaces.bucket'
		)`
	);
	const map = Object.fromEntries(result.rows.map((r) => [r.key, r.value]));
	return {
		endpoint: map['spaces.endpoint'] ?? '',
		region: map['spaces.region'] ?? 'us-east-1',
		bucket: map['spaces.bucket'] ?? ''
	};
}

async function getClient(): Promise<{ client: S3Client; bucket: string }> {
	const settings = await loadSpacesSettings();
	const accessKeyId = env.SPACES_ACCESS_KEY_ID;
	const secretAccessKey = env.SPACES_SECRET_ACCESS_KEY;

	if (!settings.endpoint || !settings.bucket || !accessKeyId || !secretAccessKey) {
		throw new StorageNotConfiguredError();
	}

	const client = new S3Client({
		endpoint: settings.endpoint,
		region: settings.region,
		credentials: { accessKeyId, secretAccessKey },
		// Spaces addresses buckets by path, not by subdomain.
		forcePathStyle: true
	});

	return { client, bucket: settings.bucket };
}

/**
 * Builds the object key for a location photo.
 *
 * The org id prefix is what the read endpoint authorizes against, so it must
 * stay the first path segment. The random name means a key cannot be guessed
 * from anything the client controls.
 */
export function locationPhotoKey(orgId: string, contentType: string): string {
	const extension = EXTENSIONS[contentType] ?? 'bin';
	return `orgs/${orgId}/locations/${crypto.randomUUID()}.${extension}`;
}

/** True when a key belongs to the given org. Guards the read endpoint. */
export function keyBelongsToOrg(key: string, orgId: string): boolean {
	return key.startsWith(`orgs/${orgId}/`);
}

/**
 * Issues a presigned PUT for a single photo.
 *
 * Content type and length are pinned into the signature, so a client cannot
 * present a small image for signing and then upload something else.
 */
export async function presignPhotoUpload(
	orgId: string,
	contentType: string,
	contentLength: number
): Promise<{ url: string; key: string }> {
	const { client, bucket } = await getClient();
	const key = locationPhotoKey(orgId, contentType);

	const url = await getSignedUrl(
		client,
		new PutObjectCommand({
			Bucket: bucket,
			Key: key,
			ContentType: contentType,
			ContentLength: contentLength
		}),
		{ expiresIn: SIGNED_URL_TTL_SECONDS }
	);

	return { url, key };
}

/** Issues a short-lived presigned GET so a private object can be displayed. */
export async function presignPhotoDownload(key: string): Promise<string> {
	const { client, bucket } = await getClient();

	return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
		expiresIn: SIGNED_URL_TTL_SECONDS
	});
}
