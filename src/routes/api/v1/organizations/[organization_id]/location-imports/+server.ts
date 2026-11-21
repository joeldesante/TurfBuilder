import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseId, requireUser } from '$lib/server/list-access';
import { error } from '@sveltejs/kit';
import { importLocationsCsv } from '$lib/server/services/locations.service';

/**
 * Imports locations from a CSV upload, each a business at a new address.
 * Invalid rows, including rows without a pin, are skipped and reported.
 *
 * @auth staff
 * @permission location.create
 * @body multipart form with `file`, a .csv with a header row: name, address_line_1, address_line_2, city, state_or_region, postal_code, country_code, latitude, longitude (latitude and longitude required)
 * @returns 201 with `{ imported, skipped, errors: Array<{ row, reason }> }`. 400 without a .csv file or for an invalid id, 401 when signed out, 403 without `location.create`, 404 when the caller is not a member
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

	return json(await importLocationsCsv(userId, orgId, await file.text()), { status: 201 });
};
