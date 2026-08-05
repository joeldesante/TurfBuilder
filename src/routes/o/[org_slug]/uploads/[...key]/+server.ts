import { json, redirect } from '@sveltejs/kit';
import {
	presignPhotoDownload,
	keyBelongsToOrg,
	StorageNotConfiguredError
} from '$lib/server/storage.js';

/**
 * Redirects to a short-lived presigned GET for a stored photo.
 *
 * Objects are private, so this is the only way to display one. The key prefix
 * check is what stops a member of one org reading another org's photos by
 * pasting a key; without it the bucket would have to be public.
 *
 * @auth org
 * @returns 302 to a presigned URL
 */
export async function GET({ params, locals }) {
	if (!locals.user || !locals.organization) {
		return json({ error: 'Unauthorized.' }, { status: 401 });
	}

	const key = params.key;
	if (!key || !keyBelongsToOrg(key, locals.organization.id)) {
		return json({ error: 'Not found.' }, { status: 404 });
	}

	let url: string;
	try {
		url = await presignPhotoDownload(key);
	} catch (e) {
		if (e instanceof StorageNotConfiguredError) {
			return json({ error: e.message }, { status: 503 });
		}
		throw e;
	}

	// Thrown outside the try so the redirect is not swallowed by the catch.
	throw redirect(302, url);
}
