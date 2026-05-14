import { getTableSchemas } from '$lib/server/db-introspection';

export async function load({ locals }) {
	const tableSchemas = await getTableSchemas(['universe', 'public']);
	return {
		orgSlug: locals.organization!.slug,
		tableSchemas
	};
}
