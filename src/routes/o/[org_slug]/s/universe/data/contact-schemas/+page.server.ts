import { error } from '@sveltejs/kit';
import { listContactSchemas } from '$lib/server/services/contact-schemas.service';

export async function load({ locals }) {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!locals.organization) throw error(404, 'Organization not found');

	return { schemas: await listContactSchemas(locals.user.id, locals.organization.id) };
}
