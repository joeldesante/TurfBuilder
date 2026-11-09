import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { can } from '$lib/auth-helpers';
import { getBucketList } from '$lib/server/services/lists.service';

export async function load({ params, locals }) {
	if (!can(locals.organization, 'turf', 'create')) throw error(403, 'Forbidden.');
	if (!z.uuid().safeParse(params.id).success) throw error(404, 'List not found');

	const list = await getBucketList(
		locals.user!.id,
		locals.organization!.id,
		params.slug,
		params.id
	);
	if (list.entity_type !== 'locations') {
		throw error(400, 'Turfs can only be cut from location lists');
	}

	return {
		listId: list.id,
		listName: list.name,
		bucketId: list.bucket_id,
		bucketSlug: params.slug
	};
}
