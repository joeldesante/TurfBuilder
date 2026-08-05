import { json } from '@sveltejs/kit';
import { z } from 'zod';
import {
	presignPhotoUpload,
	StorageNotConfiguredError,
	ALLOWED_PHOTO_TYPES
} from '$lib/server/storage.js';

/** 5 MB, comfortably above a compressed phone photo and well below a raw one. */
const MAX_UPLOAD_BYTES = 5_000_000;

const PresignSchema = z.object({
	contentType: z.enum(ALLOWED_PHOTO_TYPES),
	contentLength: z.number().int().positive().max(MAX_UPLOAD_BYTES)
});

/**
 * Issues a presigned PUT so the browser can upload a location photo straight
 * to Spaces.
 *
 * Lives outside /s/ because volunteers attach photos to their suggestions and
 * do not have a staff role.
 *
 * Org membership is the only check needed: the key is server-generated and
 * unguessable, and attaching it to a location still has to pass that
 * endpoint's own authorization.
 *
 * @auth org
 * @body contentType {string} required - image/jpeg, image/webp, or image/png
 * @body contentLength {number} required - Byte size, max 5,000,000
 * @returns { url, key }
 */
export async function POST({ request, locals }) {
	if (!locals.user || !locals.organization) {
		return json({ error: 'Unauthorized.' }, { status: 401 });
	}

	const parsed = PresignSchema.safeParse(await request.json());
	if (!parsed.success) {
		return json({ error: parsed.error.issues[0].message }, { status: 400 });
	}

	try {
		const result = await presignPhotoUpload(
			locals.organization.id,
			parsed.data.contentType,
			parsed.data.contentLength
		);
		return json(result);
	} catch (e) {
		if (e instanceof StorageNotConfiguredError) {
			return json({ error: e.message }, { status: 503 });
		}
		throw e;
	}
}
