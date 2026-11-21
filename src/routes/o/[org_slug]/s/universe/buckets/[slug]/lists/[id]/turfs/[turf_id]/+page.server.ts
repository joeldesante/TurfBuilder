import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { getTurfReport } from '$lib/server/services/turfs.service';

export async function load({ params, locals }) {
	if (!locals.organization?.role) throw error(401, 'Unauthorized');
	const uuid = z.uuid();
	if (!uuid.safeParse(params.turf_id).success || !uuid.safeParse(params.id).success) {
		throw error(404, 'Turf not found.');
	}

	const report = await getTurfReport(
		locals.user!.id,
		locals.organization.id,
		params.turf_id,
		params.id,
		params.slug
	);

	return { ...report, listId: params.id, bucketSlug: params.slug };
}
