import { error, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { requireTurfMembership } from '$lib/server/services/canvass.service';

export async function load({ locals, params }) {
	if (!locals.user) throw redirect(303, '/auth/signin');
	if (!z.uuid().safeParse(params.id).success) throw error(404, 'Turf not found.');

	// 403 unless the caller joined this turf.
	await requireTurfMembership(locals.user.id, params.id);
}
