import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { getLocationByVersion } from '$lib/server/services/locations.service';

export async function load({ params, locals }) {
	if (!z.uuid().safeParse(params.id).success) throw error(404, 'Location not found');

	return {
		location: await getLocationByVersion(locals.user!.id, locals.organization!.id, params.id)
	};
}
