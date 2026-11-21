import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { getDoor } from '$lib/server/services/canvass.service';

export async function load({ locals, params }) {
	if (!z.uuid().safeParse(params.location_id).success) {
		throw error(404, 'Location not found in this turf.');
	}

	const door = await getDoor(locals.user!.id, params.location_id);
	if (door.turfId !== params.id) throw error(404, 'Location not found in this turf.');
	return door;
}
