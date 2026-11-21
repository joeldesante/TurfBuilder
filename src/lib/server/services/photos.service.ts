import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { requireActiveMembership } from '$lib/server/list-access';
import { logger } from '$lib/server/logger';
import {
	ALLOWED_PHOTO_TYPES,
	presignPhotoDownload,
	presignPhotoUpload,
	StorageNotConfiguredError
} from '$lib/server/storage';

/** 5 MB, comfortably above a compressed phone photo and well below a raw one. */
export const MAX_PHOTO_BYTES = 5_000_000;

export const PhotoUploadSchema = z.object({
	contentType: z.enum(ALLOWED_PHOTO_TYPES),
	contentLength: z.number().int().positive().max(MAX_PHOTO_BYTES)
});

export type PhotoUpload = z.infer<typeof PhotoUploadSchema>;

/** A location photo's key: `orgs/{org id}/locations/{file}`. */
const PHOTO_KEY =
	/^orgs\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/locations\/[A-Za-z0-9._-]+$/i;

/** Storage that is not set up answers 503 with the message written for users. */
async function withStorage<T>(orgId: string, run: () => Promise<T>): Promise<T> {
	try {
		return await run();
	} catch (e) {
		if (e instanceof StorageNotConfiguredError) {
			logger.warn({ organizationId: orgId }, 'Photo requested but storage is not configured');
			throw error(503, e.message);
		}
		throw e;
	}
}

/**
 * A presigned PUT for one location photo, so the browser uploads straight to
 * object storage. Membership is the only check: volunteers attach photos to
 * their additions and hold no staff permission, the key is made here and
 * cannot be guessed, and attaching it to a location passes that endpoint's own
 * checks. 404 when the caller is not a member, 503 when storage is not set up.
 */
export async function createPhotoUpload(
	userId: string,
	orgId: string,
	input: PhotoUpload
): Promise<{ url: string; key: string }> {
	await requireActiveMembership(userId, orgId);
	return withStorage(orgId, () =>
		presignPhotoUpload(orgId, input.contentType, input.contentLength)
	);
}

/**
 * A short-lived link to a stored location photo. Objects are private, so this
 * is the only way to show one. The org is read from the key, and the caller
 * must be a member of it: that is what stops a member of one org reading
 * another's photos by pasting a key. 404 for anything that is not a location
 * photo key or is in an org the caller is not a member of.
 */
export async function getPhotoUrl(userId: string, key: string): Promise<string> {
	const orgId = PHOTO_KEY.exec(key)?.[1];
	if (!orgId) throw error(404, 'Photo not found');
	await requireActiveMembership(userId, orgId).catch((e) => {
		// The same answer whether the org or the photo is missing.
		if (e?.status === 404) throw error(404, 'Photo not found');
		throw e;
	});
	return withStorage(orgId, () => presignPhotoDownload(key));
}
