import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { importPeopleCsv } from '$lib/server/services/people.service';

/**
 * Imports people from a CSV upload. Invalid rows are skipped and reported.
 *
 * @auth staff
 * @body multipart form with `file`, a .csv with a header row: first_name, last_name, middle_name, suffix, preferred_name, dob (YYYY-MM-DD), phone, email, gender
 * @returns 201 with `{ imported, skipped, errors: Array<{ row, reason }> }`. 400 without a .csv file or for an invalid id, 401 when signed out, 403 without staff access, 404 when the caller is not a member
 */
export const POST: RequestHandler = async ({ params, locals, request }) => {
	const userId = requireUser(locals);
	const orgId = parseId(params.organization_id, 'organization');

	const form = await request.formData().catch(() => null);
	const file = form?.get('file');
	if (!(file instanceof File)) throw error(400, 'No file provided');
	if (!file.name.toLowerCase().endsWith('.csv')) {
		throw error(400, 'Unsupported file type. Upload a .csv file.');
	}

	return json(await importPeopleCsv(userId, orgId, await file.text()), { status: 201 });
};
