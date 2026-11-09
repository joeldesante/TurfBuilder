import { getTurfMap } from '$lib/server/services/canvass.service';

export async function load({ locals, params }) {
	return getTurfMap(locals.user!.id, params.id);
}
