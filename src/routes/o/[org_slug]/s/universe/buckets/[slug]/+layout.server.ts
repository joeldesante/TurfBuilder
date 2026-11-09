import { error } from '@sveltejs/kit';
import { getBucketPage } from '$lib/server/services/buckets.service';

export async function load({ params, locals }) {
	if (!locals.user || !locals.organization) throw error(401, 'Unauthorized');

	return getBucketPage(locals.user.id, locals.organization.id, params.slug);
}
