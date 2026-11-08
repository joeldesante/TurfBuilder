import { error } from '@sveltejs/kit';
import { getQueryBuilderSchemas } from '$lib/server/services/query-builder.service';

export async function load({ locals }) {
	if (!locals.user) throw error(401, 'Unauthorized');
	return {
		orgSlug: locals.organization!.slug,
		tableSchemas: await getQueryBuilderSchemas(locals.user.id)
	};
}
