import { error } from '@sveltejs/kit';
import { can } from '$lib/auth-helpers.js';

export async function load({ locals }) {
	if (!can(locals.organization, 'turf', 'create')) throw error(403, 'Forbidden.');
	return {};
}
